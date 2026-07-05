import { type Server } from "bun";
import { Context } from "./context";
import { Router } from "./router";
import {
  ValidationError,
  type BklarOptions,
  type Handler,
  type InferInput,
  type LifecycleHooks,
  type Middleware,
  type MiddlewareMeta,
  type ResponseSchemas,
  type RouteOptions,
  type Schemas,
  type WSData,
  type WSHandlers,
  type WSOptions,
} from "./types";
import { compose } from "./utils/compose";

import {
  defaultErrorHandler,
  ErrorType,
  GatewayTimeoutError,
  HttpError,
  NotFoundError,
} from "./errors";
import { defaultLogger } from "./utils/logger";
import { defaultValidator, type ValidatorAdapter } from "./validator";
import { getDefaultFastIdGen } from "./utils/fast-id";

// Define the structure for route types
export type RouteType<Method extends string, S extends Schemas, ReturnType> = {
  [M in Method]: {
    input: InferInput<S>;
    output: ReturnType extends Response ? any : ReturnType;
  };
};

interface RouteRecord {
  method: string;
  path: string;
  handler: Handler<any, any>;
  options: RouteOptions<any>;
}

export class BklarApp<Routes = {}> {
  public readonly router: Router;
  public readonly options: BklarOptions;
  private globalMiddlewares: MiddlewareMeta[] = [];
  public readonly validator: ValidatorAdapter;
  private server?: Server<any>;
  private _activeRequests = 0;
  private _stopping = false;
  private _wsClients: Set<any> = new Set();
  private _wsRooms: Map<string, Set<any>> = new Map();

  constructor(options: BklarOptions = {}) {
    this.options = {
      logger: options.logger ?? true,
      errorHandler: options.errorHandler || defaultErrorHandler,
      ...options,
    };
    this.validator = options.validator || defaultValidator;
    this.router = new Router();
  }

  get hooks(): LifecycleHooks {
    return this.options.hooks || {};
  }

  use(middleware: Middleware, priority?: number) {
    this.globalMiddlewares.push({ fn: middleware, priority: priority ?? 0 });
    return this;
  }

  // Internal helper to add routes with prefix/middleware support
  public _add(
    method: string,
    path: string,
    handler: Handler<any, any>,
    options: RouteOptions<any> = {},
    prefix: string = "",
    middlewares: Middleware[] = [],
  ) {
    const fullPath = (prefix + path).replace(/\/+/g, "/");
    const stack: Middleware[] = [...middlewares];

    // 1. Route specific middlewares from options
    if (options.middlewares) {
      stack.push(...options.middlewares);
    }

    // 2. Validation Middleware
    if (options.schemas) {
      stack.push(this.createValidationMiddleware(options.schemas));
    }

    // 3. Response Validation Middleware
    if (options.responses) {
      stack.push(this.createResponseValidationMiddleware(options.responses));
    }

    // 4. Handler Wrapper with Response Auto-Wrapping
    stack.push(async (ctx, next) => {
      if (options.timeout) {
        const controller = new AbortController();
        ctx.signal = controller.signal;
        let timer: Timer | null = null;

        const timeoutPromise = new Promise((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new GatewayTimeoutError());
          }, options.timeout);
        });

        try {
          let res = await Promise.race([handler(ctx as any), timeoutPromise]);

          if (timer) {
            clearTimeout(timer);
          }

          // SSE / streaming: if handler set _res directly and returned undefined,
          // use _res instead of overwriting it
          if (res === undefined && (ctx as any)._res instanceof Response) {
            return (ctx as any)._res;
          }

          if (!(res instanceof Response)) {
            if (typeof res === "object" || Array.isArray(res)) {
              res = new Response(JSON.stringify(res), {
                headers: { "Content-Type": "application/json" },
              });
            } else if (typeof res === "string") {
              res = new Response(res, {
                headers: { "Content-Type": "text/plain;charset=UTF-8" },
              });
            } else if (res === undefined) {
              return new Response("Internal Server Error", { status: 500 });
            }
          }
          (ctx as any)._res = res;
          return res;
        } catch (error) {
          if (timer) {
            clearTimeout(timer);
          }
          throw error;
        }
      } else {
        let res = await handler(ctx as any);

        // SSE / streaming: if handler set _res directly, use it
        if ((ctx as any)._res instanceof Response && res === undefined) {
          return (ctx as any)._res;
        }

        if (!(res instanceof Response)) {
          if (res instanceof ReadableStream) {
            res = ctx.stream(res);
          } else if (Symbol.asyncIterator in Object(res)) {
            res = ctx.sse();
            return res;
          } else if (typeof res === "object" || Array.isArray(res)) {
            res = ctx.json(res);
          } else if (typeof res === "string") {
            res = new Response(res, {
              headers: { "Content-Type": "text/plain;charset=UTF-8" },
            });
          } else if (res === undefined) {
            return new Response("Internal Server Error", { status: 500 });
          }
        }

        (ctx as any)._res = res;

        return res;
      }
    });

    this.router.add(method, fullPath, stack, options);
  }

  // Type helper to Merge Routes
  private _ret<
    Method extends string,
    Path extends string,
    S extends Schemas,
    Ret,
  >(): // phantom params for inference
  BklarApp<Routes & { [K in Path]: RouteType<Method, S, Ret> }> {
    return this as any;
  }

  get<S extends Schemas, Ret>(
    path: string,
    handler: Handler<S, Ret>,
    options?: RouteOptions<S>,
  ) {
    this._add("GET", path, handler, options);
    return this._ret<"get", typeof path, S, Ret>();
  }

  post<S extends Schemas, Ret>(
    path: string,
    handler: Handler<S, Ret>,
    options?: RouteOptions<S>,
  ) {
    this._add("POST", path, handler, options);
    return this._ret<"post", typeof path, S, Ret>();
  }

  put<S extends Schemas, Ret>(
    path: string,
    handler: Handler<S, Ret>,
    options?: RouteOptions<S>,
  ) {
    this._add("PUT", path, handler, options);
    return this._ret<"put", typeof path, S, Ret>();
  }

  delete<S extends Schemas, Ret>(
    path: string,
    handler: Handler<S, Ret>,
    options?: RouteOptions<S>,
  ) {
    this._add("DELETE", path, handler, options);
    return this._ret<"delete", typeof path, S, Ret>();
  }

  patch<S extends Schemas, Ret>(
    path: string,
    handler: Handler<S, Ret>,
    options?: RouteOptions<S>,
  ) {
    this._add("PATCH", path, handler, options);
    return this._ret<"patch", typeof path, S, Ret>();
  }

  ws<S extends Schemas>(
    path: string,
    options: WSOptions<S>,
    middlewares: Middleware[] = [],
  ) {
    const fullPath = path.replace(/\/+/g, "/");
    const stack: Middleware[] = [...middlewares];

    if (options.middlewares) {
      stack.push(...options.middlewares);
    }

    if (options.schemas) {
      stack.push(this.createValidationMiddleware(options.schemas));
    }

    const wsHandlers: WSHandlers = {
      open: options.open,
      message: options.message,
      close: options.close,
      drain: options.drain,
    };

    this.router.add("WS", fullPath, stack, options, wsHandlers);
    return this;
  }

  group(
    prefix: string,
    builder: (app: BklarApp<any>) => void,
    middlewares: Middleware[] = [],
  ) {
    const proxy = new Proxy(this, {
      get: (target, prop, receiver) => {
        if (
          ["get", "post", "put", "delete", "patch"].includes(prop as string)
        ) {
          return (
            path: string,
            handler: Handler<any, any>,
            options?: RouteOptions<any>,
          ) => {
            target._add(
              (prop as string).toUpperCase(),
              path,
              handler,
              options,
              prefix,
              middlewares,
            );
            return receiver;
          };
        }
        if (prop === "ws") {
          return (path: string, options: WSOptions<any>) => {
            target.ws(
              (prefix + path).replace(/\/+/g, "/"),
              options,
              middlewares,
            );
            return receiver;
          };
        }
        if (prop === "group") {
          return (
            subPrefix: string,
            subBuilder: any,
            subMiddlewares: any = [],
          ) => {
            target.group(
              (prefix + subPrefix).replace(/\/+/g, "/"),
              subBuilder,
              [...middlewares, ...subMiddlewares],
            );
            return receiver;
          };
        }
        return Reflect.get(target, prop, receiver);
      },
    });
    builder(proxy as any);
    return this;
  }

  private createValidationMiddleware(schemas: Schemas): Middleware {
    return async (ctx, next) => {
      await ctx.parseBody();

      const inputs = {
        query: { schema: schemas.query, data: ctx.query },
        params: { schema: schemas.params, data: ctx.params },
        body: { schema: schemas.body, data: ctx.body },
      };

      const errors: Record<string, any> = {};
      let hasError = false;

      for (const [key, { schema, data }] of Object.entries(inputs)) {
        if (!schema) continue;

        const result = await Promise.resolve(
          this.validator.validate(schema, data),
        );

        if (!result.success) {
          hasError = true;
          errors[key] = result.error;
        } else {
          (ctx as any)[key] = result.data;
        }
      }

      if (hasError) {
        throw new ValidationError(errors);
      }

      return next();
    };
  }

  private createResponseValidationMiddleware(
    responses: ResponseSchemas,
  ): Middleware {
    return async (ctx, next) => {
      const result = await next();

      let status: number;
      let response: Response;

      if (result instanceof Response) {
        response = result;
        status = result.status;
      } else if ((ctx as any)._res instanceof Response) {
        response = (ctx as any)._res;
        status = response.status;
      } else {
        return result;
      }

      const schema = responses[status];
      if (!schema) return result;

      const cloned = response.clone();
      const body = await cloned.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(body);
      } catch {
        return result;
      }

      const validationResult = await Promise.resolve(
        this.validator.validate(schema, parsed),
      );

      if (!validationResult.success) {
        console.warn(
          `[bklar] Response validation failed for ${status}:`,
          validationResult.error,
        );
      }

      return result;
    };
  }

  // Testing helper
  async request(path: string, options: RequestInit = {}): Promise<Response> {
    const url = new URL(path, "http://localhost");
    const req = new Request(url, options);
    const res = await this.handle(req);
    return res || new Response("Upgrade", { status: 101 });
  }

  private _createContext(req: Request, url?: URL): Context<any> {
    const requestIdHeaderName =
      this.options.requestId?.headerName || "X-Request-Id";
    const existingId = req.headers.get(requestIdHeaderName.toLowerCase());
    const reqIdConfig = this.options.requestId;
    const generator =
      reqIdConfig?.generator ??
      (reqIdConfig?.fast ? getDefaultFastIdGen() : () => crypto.randomUUID());
    const requestId = existingId || generator();

    const ctx = new Context<any>(
      req,
      {},
      undefined,
      requestId,
      this.options.maxBodySize,
      requestIdHeaderName,
    );
    ctx.query = url
      ? url.search
        ? Object.fromEntries(url.searchParams.entries())
        : {}
      : (() => {
          const u = new URL(req.url);
          return u.search ? Object.fromEntries(u.searchParams.entries()) : {};
        })();
    ctx._errorFormat = this.options.errorFormat || "basic";
    return ctx;
  }

  private _getSortedMiddlewares(): Middleware[] {
    if (this.globalMiddlewares.length === 0) return [];
    return [...this.globalMiddlewares]
      .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
      .map((m) => m.fn);
  }

  async handle(
    req: Request,
    server?: Server<WSData>,
  ): Promise<Response | undefined> {
    if (this._stopping) {
      return new Response("Service Unavailable", { status: 503 });
    }

    this._activeRequests++;

    const url = new URL(req.url);
    const ctx = this._createContext(req, url);

    const errorHandler = this.options.errorHandler || defaultErrorHandler;

    try {
      // --- Lifecycle: onRequest ---
      if (this.hooks.onRequest) {
        await this.hooks.onRequest(ctx);
      }

      // 0. WebSocket Upgrade Check
      if (
        req.method === "GET" &&
        req.headers.get("Upgrade")?.toLowerCase() === "websocket"
      ) {
        const match = this.router.find("WS", url.pathname);

        if (match) {
          ctx.params = match.params;
          const sortedGlobal = this._getSortedMiddlewares();
          const chain = [...sortedGlobal, ...match.handlers];
          const dispatch = compose(chain);

          try {
            const res = await dispatch(ctx);
            let finalResponse: Response | undefined;

            if (res instanceof Response) {
              finalResponse = res;
            } else if ((ctx as any)._res instanceof Response) {
              finalResponse = (ctx as any)._res;
            }

            if (finalResponse) {
              if ((ctx._headers as any).count > 0) {
                ctx._headers.forEach((value, key) => {
                  if (!finalResponse!.headers.has(key)) {
                    finalResponse!.headers.set(key, value);
                  }
                });
              }

              if (ctx._setCookies.length > 0) {
                for (const cookie of ctx._setCookies) {
                  finalResponse.headers.append("Set-Cookie", cookie);
                }
              }

              return finalResponse;
            }

            if (server && match.wsHandlers) {
              const success = server.upgrade(req, {
                data: {
                  ctx,
                  _handlers: match.wsHandlers,
                },
              });
              if (success) {
                this._wsClients.add(ctx);
                return undefined;
              }
            }

            return new Response("WebSocket upgrade failed", { status: 500 });
          } catch (error) {
            if (error instanceof ValidationError) {
              const validationError = new HttpError(
                ErrorType.VALIDATION,
                "Validation Error",
                error.details,
              );
              const response = (await errorHandler(
                validationError,
                ctx,
              )) as Response;
              if (this.hooks.onResponse) {
                await this.hooks.onResponse(ctx, response);
              }
              return response;
            }
            const response = (await errorHandler(error, ctx)) as Response;
            if (this.hooks.onResponse) {
              await this.hooks.onResponse(ctx, response);
            }
            return response;
          }
        }
      }

      // 1. Match Route
      const match = this.router.find(req.method, url.pathname);

      // 2. Build Chain
      const sortedGlobal = this._getSortedMiddlewares();
      const chain: Middleware[] = [];

      // Eager body size check
      if (this.options.maxBodySize && this.options.maxBodySize > 0) {
        chain.push(async (ctx, next) => {
          const cl = ctx.req.headers.get("content-length");
          if (cl && parseInt(cl, 10) > this.options.maxBodySize!) {
            throw Object.assign(new Error("Payload Too Large"), {
              status: 413,
            });
          }
          return next();
        });
      }

      chain.push(...sortedGlobal);

      if (match) {
        ctx.params = match.params;
        chain.push(...match.handlers);
      } else {
        chain.push(() => {
          throw new NotFoundError();
        });
      }

      const dispatch = compose(chain);

      try {
        let res = await dispatch(ctx);

        if (res === undefined && (ctx as any)._res instanceof Response) {
          res = (ctx as any)._res;
        }

        if (res instanceof Response) {
          // Merge persistent headers
          if ((ctx._headers as any).count > 0) {
            ctx._headers.forEach((value, key) => {
              if (!res.headers.has(key)) {
                res.headers.set(key, value);
              }
            });
          }

          // Append request ID + server timings (already set by ctx helpers if used)
          const reqIdHeader =
            (ctx as any)._requestIdHeaderName || "X-Request-Id";
          if ((ctx as any).requestId && !res.headers.has(reqIdHeader)) {
            res.headers.set(reqIdHeader, (ctx as any).requestId);
          }
          if (
            (ctx as any)._serverTimings?.length > 0 &&
            !res.headers.has("Server-Timing")
          ) {
            const value = (ctx as any)._serverTimings
              .map((t: any) => {
                let entry = t.name;
                if (t.description) entry += `;desc="${t.description}"`;
                entry += `;dur=${Math.round(t.duration)}`;
                return entry;
              })
              .join(", ");
            res.headers.set("Server-Timing", value);
          }

          // Append cookies
          if (ctx._setCookies.length > 0) {
            const existingCookies =
              typeof res.headers.getSetCookie === "function"
                ? res.headers.getSetCookie()
                : [];

            for (const cookie of ctx._setCookies) {
              if (!existingCookies.includes(cookie)) {
                res.headers.append("Set-Cookie", cookie);
              }
            }
          }

          // --- Lifecycle: onResponse ---
          if (this.hooks.onResponse) {
            await this.hooks.onResponse(ctx, res);
          }

          return res;
        }

        return new Response("Internal Server Error", { status: 500 });
      } catch (error: any) {
        if (error?.status === 413) {
          const res = new Response(
            JSON.stringify({
              error: "Payload Too Large",
              message: "Request body exceeds size limit",
              statusCode: 413,
            }),
            { status: 413, headers: { "Content-Type": "application/json" } },
          );

          if ((ctx._headers as any).count > 0) {
            ctx._headers.forEach((value, key) => {
              res.headers.set(key, value);
            });
          }
          if (ctx._setCookies.length > 0) {
            for (const cookie of ctx._setCookies) {
              res.headers.append("Set-Cookie", cookie);
            }
          }
          if (this.hooks.onResponse) {
            await this.hooks.onResponse(ctx, res);
          }
          return res;
        }

        let res: Response;
        if (error instanceof ValidationError) {
          const validationError = new HttpError(
            ErrorType.VALIDATION,
            "Validation Error",
            error.details,
          );
          res = (await errorHandler(validationError, ctx)) as Response;
        } else {
          res = (await errorHandler(error, ctx)) as Response;
        }

        // Merge persistent headers
        if ((ctx._headers as any).count > 0) {
          ctx._headers.forEach((value, key) => {
            res.headers.set(key, value);
          });
        }

        // Append cookies
        if (ctx._setCookies.length > 0) {
          for (const cookie of ctx._setCookies) {
            res.headers.append("Set-Cookie", cookie);
          }
        }

        if (this.hooks.onResponse) {
          await this.hooks.onResponse(ctx, res);
        }

        return res;
      }
    } finally {
      this._activeRequests--;
    }
  }

  /**
   * Broadcast a message to all subscribers of a topic.
   */
  broadcast(topic: string, data: string | ArrayBuffer | Uint8Array) {
    if (this.server) {
      this.server.publish(topic, data);
    } else {
      console.warn(
        "⚠️ app.broadcast() called before app.listen(). Message dropped.",
      );
    }
  }

  /**
   * Send a message to all WebSocket clients in a room.
   */
  to(room: string) {
    return {
      send: (data: string | ArrayBuffer | Uint8Array) => {
        const clients = this._wsRooms.get(room);
        if (!clients) return;
        for (const ws of clients) {
          try {
            ws.send(data);
          } catch {
            clients.delete(ws);
          }
        }
      },
      sendText: (data: string) => {
        const clients = this._wsRooms.get(room);
        if (!clients) return;
        for (const ws of clients) {
          try {
            ws.sendText(data);
          } catch {
            clients.delete(ws);
          }
        }
      },
    };
  }

  /**
   * Add a WebSocket client to a room.
   */
  join(ws: any, room: string) {
    if (!this._wsRooms.has(room)) {
      this._wsRooms.set(room, new Set());
    }
    this._wsRooms.get(room)!.add(ws);
  }

  /**
   * Remove a WebSocket client from a room.
   */
  leave(ws: any, room: string) {
    this._wsRooms.get(room)?.delete(ws);
  }

  get activeRequests(): number {
    return this._activeRequests;
  }

  get isStopping(): boolean {
    return this._stopping;
  }

  listen(
    port: number | string = 3000,
    callback?: (server: Server<any>) => void,
  ): Server<any> {
    const loggingEnabled = this.options.logger !== false;
    const logger =
      typeof this.options.logger === "function"
        ? this.options.logger
        : defaultLogger;

    const pingInterval = this.options.websocket?.pingInterval;
    const pongTimeout = this.options.websocket?.pongTimeout;

    // Start heartbeat interval if configured
    let heartbeatTimer: Timer | null = null;
    if (pingInterval && pingInterval > 0) {
      heartbeatTimer = setInterval(() => {
        for (const client of this._wsClients) {
          try {
            (client as any)._ws?.ping();
          } catch {
            this._wsClients.delete(client);
          }
        }
      }, pingInterval);
    }

    const server = Bun.serve<WSData>({
      port: Number(port),
      idleTimeout: this.options.idleTimeout,
      websocket: {
        ...this.options.websocket,
        open: (ws) => {
          ws.data._handlers.open?.(ws);
        },
        message: (ws, message) => ws.data._handlers.message?.(ws, message),
        close: (ws, code, reason) => {
          ws.data._handlers.close?.(ws, code, reason);
          this._wsClients.delete(ws.data.ctx);
          for (const [, clients] of this._wsRooms) {
            clients.delete(ws);
          }
        },
        drain: (ws) => ws.data._handlers.drain?.(ws),
      },
      fetch: async (req, srv) => {
        let start: number | undefined;
        let ip: string | undefined;

        if (loggingEnabled) {
          start = performance.now();
          ip =
            req.headers.get("x-forwarded-for")?.split(",")[0] ||
            srv.requestIP(req)?.address;
          if (ip) {
            req.headers.set("X-Client-IP", ip);
          }
        }

        const res = await this.handle(req, srv);

        if (res && loggingEnabled) {
          const duration = performance.now() - (start as number);
          logger(req, duration, res.status, ip);
        }

        return res;
      },
      error: (error) => {
        console.error("🔥 Uncaught Framework Error:", error);
        return new Response("Internal Server Error", { status: 500 });
      },
    });

    this.server = server;
    this._stopping = false;

    console.log(
      `✅ Server listening on http://${server.hostname}:${server.port}`,
    );

    // --- Lifecycle: onStart ---
    if (this.hooks.onStart) {
      Promise.resolve(this.hooks.onStart(server)).catch(console.error);
    }

    if (callback) callback(server);
    return server;
  }

  /**
   * Gracefully stop the server. Stops accepting new connections,
   * waits for in-flight requests, then shuts down.
   */
  async stop(gracePeriodMs: number = 5000): Promise<void> {
    this._stopping = true;

    // --- Lifecycle: onStop ---
    if (this.hooks.onStop) {
      await Promise.resolve(this.hooks.onStop()).catch(console.error);
    }

    // Stop accepting new connections
    if (this.server) {
      this.server.stop(true);
    }

    // Wait for in-flight requests with timeout
    const deadline = Date.now() + gracePeriodMs;
    while (this._activeRequests > 0 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 50));
    }

    // Force stop
    if (this.server) {
      this.server.stop(false);
    }
  }

  /**
   * Install graceful shutdown handlers for SIGTERM and SIGINT.
   */
  gracefulShutdown(gracePeriodMs: number = 5000) {
    const shutdown = async (signal: string) => {
      console.log(`\n[${signal}] Initiating graceful shutdown...`);
      await this.stop(gracePeriodMs);
      console.log("Shutdown complete.");
      process.exit(0);
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));

    return this;
  }

  public get routes() {
    return this.router.getRoutes();
  }
}

export function Bklar(options?: BklarOptions) {
  return new BklarApp(options);
}

// Export for Type Inference
export type InferRoutes<T> = T extends BklarApp<infer R> ? R : never;
