import { type Server } from "bun";
import { Router } from "./router";

export class App {
  public router: Router;
  private server: Server | null = null;

  constructor() {
    this.router = new Router();
  }

  get(path: string, ...args: any[]) {
    this.router.add("GET", path, ...args);
    return this;
  }
  post(path: string, ...args: any[]) {
    this.router.add("POST", path, ...args);
    return this;
  }
  put(path: string, ...args: any[]) {
    this.router.add("PUT", path, ...args);
    return this;
  }
  delete(path: string, ...args: any[]) {
    this.router.add("DELETE", path, ...args);
    return this;
  }
  group(prefix: string, ...args: any[]) {
    this.router.group(prefix, ...args);
    return this;
  }
  use(...args: any[]) {
    this.router.use(...args);
    return this;
  }

  listen(port: number | string, callback?: () => void) {
    console.log(`🚀 Server starting on port ${port}...`);

    this.server = Bun.serve({
      port: Number(port),
      fetch: (req) => this.router.handle(req),
      error: (error) => {
        console.error("Framework Error:", error);
        return new Response("Internal Server Error", { status: 500 });
      },
    });

    console.log(
      `✅ Server listening on http://${this.server.hostname}:${this.server.port}`
    );
    if (callback) {
      callback();
    }

    return this.server;
  }
}

export function createApp() {
  return new App();
}
