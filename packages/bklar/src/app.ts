import { type Server } from "bun";
import { Router } from "./router";
import type {
  BklarOptions,
  Handler,
  Middleware,
  RouteOptions,
  Schemas,
} from "./types";
import { defaultLogger } from "./utils/logger";

export class BklarApp {
  public readonly router: Router;
  public readonly options: BklarOptions;

  constructor(options: BklarOptions = {}) {
    this.options = {
      logger: options.logger ?? true,
      ...options,
    };
    this.router = new Router({ errorHandler: this.options.errorHandler });
  }

  use(middleware: Middleware) {
    this.router.use(middleware);
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

        const { response: res, context } = await this.router.handle(req);

        if (context?.state.corsHeaders) {
          for (const [key, value] of Object.entries(
            context.state.corsHeaders as Record<string, string>
          )) {
            res.headers.set(key, value);
          }
        }

        if (loggingEnabled) {
          const duration = performance.now() - start;
          const ip =
            req.headers.get("x-forwarded-for")?.split(",")[0] ||
            server.requestIP(req)?.address;

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
