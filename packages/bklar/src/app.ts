import { type Server } from "bun";
import { Router } from "./router";
import { Context } from "./context";
import { compose } from "./utils/compose";
import {
  type BklarOptions,
  type Handler,
  type Middleware,
  type RouteOptions,
  type Schemas,
  ValidationError,
} from "./types";
import {
  defaultErrorHandler,
  ErrorType,
  HttpError,
  NotFoundError,
} from "./errors";
import { defaultLogger } from "./utils/logger";

export class BklarApp {
  public readonly router: Router;
  public readonly options: BklarOptions;
  private globalMiddlewares: Middleware[] = [];

  constructor(options: BklarOptions = {}) {
    this.options = {
      logger: options.logger ?? true,
      errorHandler: options.errorHandler || defaultErrorHandler,
      ...options,
    };
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
    handler: Handler<any>,
    options: RouteOptions<any> = {},
    prefix: string = "",
    middlewares: Middleware[] = []
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

    // 3. Handler Wrapper
    stack.push(async (ctx, next) => {
      const res = await handler(ctx as any);
      return res;
    });

    this.router.add(method, fullPath, stack);
  }

  get<S extends Schemas>(
    path: string,
    handler: Handler<S>,
    options?: RouteOptions<S>
  ) {
    this._add("GET", path, handler, options);
    return this;
  }

  post<S extends Schemas>(
    path: string,
    handler: Handler<S>,
    options?: RouteOptions<S>
  ) {
    this._add("POST", path, handler, options);
    return this;
  }

  put<S extends Schemas>(
    path: string,
    handler: Handler<S>,
    options?: RouteOptions<S>
  ) {
    this._add("PUT", path, handler, options);
    return this;
  }

  delete<S extends Schemas>(
    path: string,
    handler: Handler<S>,
    options?: RouteOptions<S>
  ) {
    this._add("DELETE", path, handler, options);
    return this;
  }

  patch<S extends Schemas>(
    path: string,
    handler: Handler<S>,
    options?: RouteOptions<S>
  ) {
    this._add("PATCH", path, handler, options);
    return this;
  }

  group(
    prefix: string,
    builder: (app: BklarApp) => void,
    middlewares: Middleware[] = []
  ) {
    const proxy = new Proxy(this, {
      get: (target, prop, receiver) => {
        if (
          ["get", "post", "put", "delete", "patch"].includes(prop as string)
        ) {
          return (
            path: string,
            handler: Handler<any>,
            options?: RouteOptions<any>
          ) => {
            target._add(
              (prop as string).toUpperCase(),
              path,
              handler,
              options,
              prefix,
              middlewares
            );
            return receiver;
          };
        }
        if (prop === "group") {
          return (
            subPrefix: string,
            subBuilder: any,
            subMiddlewares: any = []
          ) => {
            target.group(
              (prefix + subPrefix).replace(/\/+/g, "/"),
              subBuilder,
              [...middlewares, ...subMiddlewares]
            );
            return receiver;
          };
        }
        return Reflect.get(target, prop, receiver);
      },
    });
    builder(proxy);
    return this;
  }

  private createValidationMiddleware(schemas: Schemas): Middleware {
    return async (ctx, next) => {
      await ctx.parseBody();

      const results = {
        query: schemas.query?.safeParse(ctx.query),
        params: schemas.params?.safeParse(ctx.params),
        body: schemas.body?.safeParse(ctx.body),
      };

      const errors: Record<string, any> = {};
      let hasError = false;

      for (const [key, result] of Object.entries(results)) {
        if (result && !result.success) {
          hasError = true;
          errors[key] = result.error.flatten().fieldErrors;
        } else if (result?.success) {
          (ctx as any)[key] = result.data;
        }
      }

      if (hasError) {
        throw new ValidationError(errors);
      }

      return next();
    };
  }

  async handle(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const ctx = new Context(req, {});
    ctx.query = Object.fromEntries(url.searchParams.entries());

    // 1. Match Route
    const match = this.router.find(req.method, url.pathname);
    
    // 2. Build Chain
    const chain = [...this.globalMiddlewares];
    
    if (match) {
        ctx.params = match.params;
        chain.push(...match.handlers);
    } else {
        chain.push(() => { throw new NotFoundError(); });
    }

    const dispatch = compose(chain);
    const errorHandler = this.options.errorHandler || defaultErrorHandler;

    try {
      const res = await dispatch(ctx);
      if (res instanceof Response) return res;
      // If we got here and no response, it implies middlewares didn't return next() result
      // or the chain ended without returning Response (e.g. 404 handler threw error?)
      // Actually 404 handler throws NotFoundError, so we go to catch block.
      // If we are here, it means we have void result.
      return new Response("Internal Server Error", { status: 500 });
    } catch (error) {
       if (error instanceof ValidationError) {
        const validationError = new HttpError(
          ErrorType.VALIDATION,
          "Validation Error",
          error.details
        );
        return errorHandler(validationError, ctx);
      }
      return errorHandler(error, ctx);
    }
  }

  listen(port: number | string, callback?: (server: Server) => void): Server {
    const loggingEnabled = this.options.logger !== false;
    const logger =
      typeof this.options.logger === "function"
        ? this.options.logger
        : defaultLogger;

    const server = Bun.serve({
      port: Number(port),
      fetch: async (req, server) => {
        const start = performance.now();
        
        // IP logic
        const ip =
           req.headers.get("x-forwarded-for")?.split(",")[0] ||
           server.requestIP(req)?.address;
        if (ip) {
            req.headers.set("X-Client-IP", ip);
        }

        const res = await this.handle(req);

        if (loggingEnabled) {
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

    console.log(
      `✅ Server listening on http://${server.hostname}:${server.port}`
    );

    if (callback) callback(server);
    return server;
  }
}

export function Bklar(options?: BklarOptions) {
  return new BklarApp(options);
}
