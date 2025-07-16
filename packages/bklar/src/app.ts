import { type Server } from "bun";
import { Router } from "./router";
import type {
  BklarOptions,
  ErrorHook,
  Handler,
  Hook,
  Middleware,
  ResponseHook,
  Route,
  RouteOptions,
  Schemas,
} from "./types";
import { defaultLogger } from "./utils/logger";

export class BklarApp {
  public readonly router: Router;
  public readonly options: BklarOptions;
  private hooks: Required<Omit<BklarOptions, "logger" | "errorHandler">> = {
    onRequest: [],
    preParse: [],
    preValidation: [],
    preHandler: [],
    onResponse: [],
    onError: [],
  };

  constructor(options: BklarOptions = {}) {
    this.options = {
      logger: options.logger ?? true,
      ...options,
    };
    this.router = new Router({
      errorHandler: this.options.errorHandler,
      hooks: this.hooks,
    });
  }

  use(hook: Hook) {
    this.hooks.onRequest.push(hook);
    return this;
  }

  get<S extends Schemas>(
    path: string,
    handler: Handler<S>,
    options?: RouteOptions<S>
  ) {
    this.router.get(path, handler, options);
    return this;
  }

  post<S extends Schemas>(
    path: string,
    handler: Handler<S>,
    options?: RouteOptions<S>
  ) {
    this.router.post(path, handler, options);
    return this;
  }

  put<S extends Schemas>(
    path: string,
    handler: Handler<S>,
    options?: RouteOptions<S>
  ) {
    this.router.put(path, handler, options);
    return this;
  }

  delete<S extends Schemas>(
    path: string,
    handler: Handler<S>,
    options?: RouteOptions<S>
  ) {
    this.router.delete(path, handler, options);
    return this;
  }

  patch<S extends Schemas>(
    path: string,
    handler: Handler<S>,
    options?: RouteOptions<S>
  ) {
    this.router.patch(path, handler, options);
    return this;
  }

  group(
    prefix: string,
    builder: (router: Router) => void,
    middlewares: Middleware[] = []
  ) {
    this.router.group(prefix, builder, middlewares);
    return this;
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

        // Add client IP to request headers
        const ip =
          req.headers.get("x-forwarded-for")?.split(",")[0] ||
          server.requestIP(req)?.address;
        if (ip) {
          req.headers.set("X-Client-IP", ip);
        }

        const res = await this.router.handle(req);

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

  onRequest(hook: Hook) {
    this.hooks.onRequest.push(hook);
    return this;
  }
  preParse(hook: Hook) {
    this.hooks.preParse.push(hook);
    return this;
  }
  preValidation(hook: Hook) {
    this.hooks.preValidation.push(hook);
    return this;
  }
  preHandler(hook: Hook) {
    this.hooks.preHandler.push(hook);
    return this;
  }
  onResponse(hook: ResponseHook) {
    this.hooks.onResponse.push(hook);
    return this;
  }
  onError(hook: ErrorHook) {
    this.hooks.onError.push(hook);
    return this;
  }

  public get routes(): Route<any>[] {
    return this.router.getRoutes();
  }
}

export function Bklar(options?: BklarOptions) {
  return new BklarApp(options);
}

export type BklarInstance = ReturnType<typeof Bklar>;
