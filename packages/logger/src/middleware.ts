import type { Middleware } from "bklar";
import { randomUUID } from "node:crypto";
import { Logger } from "./logger";
import type { LoggerOptions } from "./types";

export interface RequestLoggerOptions extends LoggerOptions {
  /** If false, disables the automatic "request completed" log. */
  logRequests?: boolean;
}

/**
 * Global logging middleware.
 * - Injects `ctx.logger` and `ctx.reqId`
 * - Logs request completion details
 */
export function logger(options: RequestLoggerOptions = {}): Middleware {
  // Use existing logger instance or create new one
  const parentLogger = new Logger(options);
  const logRequests = options.logRequests ?? true;

  return async (ctx, next) => {
    const start = performance.now();

    // 1. Trace ID
    const reqId = ctx.req.headers.get("X-Request-Id") || randomUUID();
    ctx.req.headers.set("X-Request-Id", reqId); // propagate
    ctx.reqId = reqId;

    // 2. Child Logger injection
    // Every log inside this request will have reqId attached
    ctx.logger = parentLogger.child({ reqId });

    try {
      // 3. Process
      const res = await next();

      const response =
        res instanceof Response
          ? res
          : (ctx as any)._res instanceof Response
          ? (ctx as any)._res
          : null;

      if (!response) return res;

      // 4. Attach ID to response
      response.headers.set("X-Request-Id", reqId);

      // 5. Log Access
      if (logRequests) {
        const durationMs = Math.round(performance.now() - start);
        const status = response.status;

        const logData = {
          req: {
            method: ctx.req.method,
            url: ctx.req.url,
            // Redaction happens inside logger class
            headers: Object.fromEntries(ctx.req.headers.entries()),
          },
          res: {
            status,
            durationMs,
          },
        };

        if (status >= 500) {
          ctx.logger.error(logData, "Request Failed");
        } else if (status >= 400) {
          ctx.logger.warn(logData, "Client Error");
        } else {
          ctx.logger.info(logData, "Request Completed");
        }
      }

      return response;
    } catch (err: any) {
      // 6. Log Uncaught Errors
      const durationMs = Math.round(performance.now() - start);
      ctx.logger.error(
        {
          err: {
            message: err.message,
            stack: err.stack,
            name: err.name,
          },
          res: { status: 500, durationMs },
        },
        "Unhandled Exception"
      );

      throw err; // Re-throw so the global ErrorHandler catches it
    }
  };
}
