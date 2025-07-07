import { type Server } from "bun";
import { Router } from "./router";
import type { Handler, Middleware, RouteOptions, Schemas } from "./types";

export class App {
  public readonly router: Router;

  constructor() {
    this.router = new Router();
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
    const server = Bun.serve({
      port: Number(port),
      fetch: (req) => this.router.handle(req),
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

export function createApp() {
  return new App();
}
