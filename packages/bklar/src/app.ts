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
  type InferInput,
  ValidationError,
} from "./types";
import {
  defaultErrorHandler,
  ErrorType,
  HttpError,
  NotFoundError,
} from "./errors";
import { defaultLogger } from "./utils/logger";

// Define the structure for route types
export type RouteType<
  Method extends string,
  S extends Schemas,
  ReturnType
> = {
  [M in Method]: {
    input: InferInput<S>;
    output: ReturnType extends Response ? any : ReturnType; // If Response, we can't infer much, otherwise it's the JSON type
  };
};

export class BklarApp<Routes = {}> {
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
    handler: Handler<any, any>,
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

    // 3. Handler Wrapper with Response Auto-Wrapping
    stack.push(async (ctx, next) => {
      const res = await handler(ctx as any);
      
      if (res instanceof Response) {
        return res;
      }
      
      // Auto-wrap JSON/Strings
      if (typeof res === "object" || Array.isArray(res)) {
         return ctx.json(res);
      }
      if (typeof res === "string") {
         return ctx.text(res);
      }
      // If void/undefined, we expect the handler to have handled the response manually or it's a mistake.
      // But for type safety, we usually expect a return.
      // If it is absolutely void/null, send 200 OK empty? 
      // Current behavior: return undefined, caught by final handler -> 500 or 404
      // Let's assume user must return something or use ctx methods.
      // If they used ctx.json(), that returns a Response, so we are good.
      // If they just return { data: 1 }, we caught it above.
      
      return res;
    });

    this.router.add(method, fullPath, stack);
  }

  // Type helper to Merge Routes
  private _ret<Method extends string, Path extends string, S extends Schemas, Ret>(
     // phantom params for inference
  ): BklarApp<Routes & { [K in Path]: RouteType<Method, S, Ret> }> {
      return this as any;
  }

  get<S extends Schemas, Ret>(
    path: string,
    handler: Handler<S, Ret>,
    options?: RouteOptions<S>
  ) {
    this._add("GET", path, handler, options);
    return this._ret<"get", typeof path, S, Ret>();
  }

  post<S extends Schemas, Ret>(
    path: string,
    handler: Handler<S, Ret>,
    options?: RouteOptions<S>
  ) {
    this._add("POST", path, handler, options);
    return this._ret<"post", typeof path, S, Ret>();
  }

  put<S extends Schemas, Ret>(
    path: string,
    handler: Handler<S, Ret>,
    options?: RouteOptions<S>
  ) {
    this._add("PUT", path, handler, options);
    return this._ret<"put", typeof path, S, Ret>();
  }

  delete<S extends Schemas, Ret>(
    path: string,
    handler: Handler<S, Ret>,
    options?: RouteOptions<S>
  ) {
    this._add("DELETE", path, handler, options);
    return this._ret<"delete", typeof path, S, Ret>();
  }

  patch<S extends Schemas, Ret>(
    path: string,
    handler: Handler<S, Ret>,
    options?: RouteOptions<S>
  ) {
    this._add("PATCH", path, handler, options);
    return this._ret<"patch", typeof path, S, Ret>();
  }

  group(
    prefix: string,
    builder: (app: BklarApp<any>) => void,
    middlewares: Middleware[] = []
  ) {
    // Note: TypeScript inference for groups is extremely hard to propagate cleanly 
    // without complex recursive types. For this v2 prototype, we will accept that
    // routes inside a group might need manual type casting or the builder pattern
    // limits inference scope.
    // HOWEVER, we can try to make it work by having the builder return the modified app.
    // For now, we keep the runtime logic. Ideally, builder would take `app` and return `app`.
    
    const proxy = new Proxy(this, {
      get: (target, prop, receiver) => {
        if (
          ["get", "post", "put", "delete", "patch"].includes(prop as string)
        ) {
          return (
            path: string,
            handler: Handler<any, any>,
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
    builder(proxy as any);
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
      // Handle the case where the chain finishes but no response was returned
      // (e.g. middleware didn't return, or handler returned undefined)
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

// Export for Type Inference
export type InferRoutes<T> = T extends BklarApp<infer R> ? R : never;
