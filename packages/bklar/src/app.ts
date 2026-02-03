import { type Server } from "bun";
import { Context } from "./context";
import { Router } from "./router";
import {
  ValidationError,
  type BklarOptions,
  type Handler,
  type InferInput,
  type Middleware,
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

// Define the structure for route types
export type RouteType<Method extends string, S extends Schemas, ReturnType> = {
  [M in Method]: {
    input: InferInput<S>;
    output: ReturnType extends Response ? any : ReturnType;
  };
};

export class BklarApp<Routes = {}> {
  public readonly router: Router;
  public readonly options: BklarOptions;
  private globalMiddlewares: Middleware[] = [];
  public readonly validator: ValidatorAdapter;
  private server?: Server<any>;

  constructor(options: BklarOptions = {}) {
    this.options = {
      logger: options.logger ?? true,
      errorHandler: options.errorHandler || defaultErrorHandler,
      ...options,
    };
    this.validator = options.validator || defaultValidator;
    this.router = new Router();
  }

  use(middleware: Middleware) {
    this.globalMiddlewares.push(middleware);
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

    // 3. Handler Wrapper with Response Auto-Wrapping
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

          if (!(res instanceof Response)) {
            if (typeof res === "object" || Array.isArray(res)) {
              res = ctx.json(res);
            } else if (typeof res === "string") {
              res = ctx.text(res);
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

        if (!(res instanceof Response)) {
          if (typeof res === "object" || Array.isArray(res)) {
            res = ctx.json(res);
          } else if (typeof res === "string") {
            res = ctx.text(res);
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

    // 1. Route specific middlewares from options
    if (options.middlewares) {
      stack.push(...options.middlewares);
    }

    // 2. Validation Middleware
    if (options.schemas) {
      stack.push(this.createValidationMiddleware(options.schemas));
    }

    // Extract WS handlers
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

  // Testing helper
  async request(path: string, options: RequestInit = {}): Promise<Response> {
    const url = new URL(path, "http://localhost");
    const req = new Request(url, options);
    const res = await this.handle(req);
    return res || new Response("Upgrade", { status: 101 });
  }

  async handle(
    req: Request,
    server?: Server<WSData>,
  ): Promise<Response | undefined> {
    const url = new URL(req.url);
    const ctx = new Context(req, {});
    ctx.query = Object.fromEntries(url.searchParams.entries());

    const errorHandler = this.options.errorHandler || defaultErrorHandler;

    // 0. WebSocket Upgrade Check
    if (
      req.method === "GET" &&
      req.headers.get("Upgrade")?.toLowerCase() === "websocket"
    ) {
      const match = this.router.find("WS", url.pathname);

      if (match) {
        ctx.params = match.params;
        const chain = [...this.globalMiddlewares, ...match.handlers];
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
            ctx._headers.forEach((value, key) => {
              if (!finalResponse!.headers.has(key)) {
                finalResponse!.headers.set(key, value);
              }
            });

            for (const cookie of ctx._setCookies) {
              finalResponse.headers.append("Set-Cookie", cookie);
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
            if (success) return undefined;
          }

          return new Response("WebSocket upgrade failed", { status: 500 });
        } catch (error) {
          if (error instanceof ValidationError) {
            const validationError = new HttpError(
              ErrorType.VALIDATION,
              "Validation Error",
              error.details,
            );
            return errorHandler(validationError, ctx) as Response;
          }
          return errorHandler(error, ctx) as Response;
        }
      }
    }

    // 1. Match Route
    const match = this.router.find(req.method, url.pathname);

    // 2. Build Chain
    const chain = [...this.globalMiddlewares];

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
        ctx._headers.forEach((value, key) => {
          if (!res.headers.has(key)) {
            res.headers.set(key, value);
          }
        });

        // Append cookies
        const existingCookies =
          typeof res.headers.getSetCookie === "function"
            ? res.headers.getSetCookie()
            : [];

        for (const cookie of ctx._setCookies) {
          if (!existingCookies.includes(cookie)) {
            res.headers.append("Set-Cookie", cookie);
          }
        }
        return res;
      }

      console.log("DEBUG v2: Dispatch returned non-Response:", typeof res, res);

      return new Response("Internal Server Error", { status: 500 });
    } catch (error) {
      let res: Response;
      if (error instanceof ValidationError) {
        const validationError = new HttpError(
          ErrorType.VALIDATION,
          "Validation Error",
          error.details,
        );
        res = errorHandler(validationError, ctx) as Response;
      } else {
        res = errorHandler(error, ctx) as Response;
      }

      // Merge persistent headers
      ctx._headers.forEach((value, key) => {
        res.headers.set(key, value);
      });

      // Append cookies
      for (const cookie of ctx._setCookies) {
        res.headers.append("Set-Cookie", cookie);
      }

      return res;
    }
  }

  /**
   * Broadcast a message to all subscribers of a topic.
   * Note: This only works after app.listen() is called.
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

  listen(
    port: number | string = 3000,
    callback?: (server: Server<any>) => void,
  ): Server<any> {
    const loggingEnabled = this.options.logger !== false;
    const logger =
      typeof this.options.logger === "function"
        ? this.options.logger
        : defaultLogger;

    const server = Bun.serve<WSData>({
      port: Number(port),
      idleTimeout: this.options.idleTimeout,
      websocket: {
        ...this.options.websocket,
        open: (ws) => ws.data._handlers.open?.(ws),
        message: (ws, message) => ws.data._handlers.message?.(ws, message),
        close: (ws, code, reason) =>
          ws.data._handlers.close?.(ws, code, reason),
        drain: (ws) => ws.data._handlers.drain?.(ws),
      },
      fetch: async (req, server) => {
        const start = performance.now();

        // IP logic
        const ip =
          req.headers.get("x-forwarded-for")?.split(",")[0] ||
          server.requestIP(req)?.address;
        if (ip) {
          req.headers.set("X-Client-IP", ip);
        }

        const res = await this.handle(req, server);

        // Don't log websocket upgrades (which return undefined)
        if (res && loggingEnabled) {
          const duration = performance.now() - start;
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

    console.log(
      `✅ Server listening on http://${server.hostname}:${server.port}`,
    );

    if (callback) callback(server);
    return server;
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
