import { type Server } from "bun";
import { Router } from "./router";
import type { Handler, Middleware, RouteOptions, RouteSchemas } from "./types";

export class App {
  public readonly router: Router;
  private server: Server | null = null;

  constructor() {
    this.router = new Router();
  }

  // Private method to handle route registration logic
  private addRoute<S extends RouteSchemas>(
    method: string,
    path: string,
    args: [RouteOptions<S>] | [Handler<S>] | [Middleware[], Handler<S>]
  ): this {
    let options: RouteOptions<S>;

    if (args.length === 1) {
      if (typeof args[0] === "function") {
        // Case: app.get(path, handler)
        options = { handler: args[0] };
      } else {
        // Case: app.get(path, { handler, schemas, middlewares })
        options = args[0];
      }
    } else {
      // Case: app.get(path, middlewares, handler)
      options = { middlewares: args[0] as Middleware[], handler: args[1] };
    }

    this.router.add(method, path, options);
    return this;
  }

  // Convenience methods for HTTP verbs
  get<S extends RouteSchemas>(
    path: string,
    ...args: [RouteOptions<S>] | [Handler<S>] | [Middleware[], Handler<S>]
  ): this {
    return this.addRoute("GET", path, args);
  }

  post<S extends RouteSchemas>(
    path: string,
    ...args: [RouteOptions<S>] | [Handler<S>] | [Middleware[], Handler<S>]
  ): this {
    return this.addRoute("POST", path, args);
  }

  put<S extends RouteSchemas>(
    path: string,
    ...args: [RouteOptions<S>] | [Handler<S>] | [Middleware[], Handler<S>]
  ): this {
    return this.addRoute("PUT", path, args);
  }

  delete<S extends RouteSchemas>(
    path: string,
    ...args: [RouteOptions<S>] | [Handler<S>] | [Middleware[], Handler<S>]
  ): this {
    return this.addRoute("DELETE", path, args);
  }

  patch<S extends RouteSchemas>(
    path: string,
    ...args: [RouteOptions<S>] | [Handler<S>] | [Middleware[], Handler<S>]
  ): this {
    return this.addRoute("PATCH", path, args);
  }

  // Methods for middlewares and groups
  use(middleware: Middleware): this {
    this.router.use(middleware);
    return this;
  }

  group(
    prefix: string,
    builder: (router: Router) => void,
    middlewares: Middleware[] = []
  ): this {
    this.router.group(prefix, builder, middlewares);
    return this;
  }

  // Encapsulates server startup logic
  listen(port: number | string, callback?: (server: Server) => void): Server {
    console.log(`🚀 Framework server starting...`);

    this.server = Bun.serve({
      port: Number(port),
      fetch: (req) => this.router.handle(req),
      error: (error) => {
        console.error("🔥 Uncaught Framework Error:", error);
        return new Response("Internal Server Error", { status: 500 });
      },
    });

    console.log(
      `✅ Server listening on http://${this.server.hostname}:${this.server.port}`
    );

    if (callback) {
      callback(this.server);
    }

    return this.server;
  }
}

// Factory function for a cleaner API
export function createApp() {
  return new App();
}
