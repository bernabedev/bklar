import type { BklarApp, InferContext } from "bklar";
import type { Server, ServerWebSocket } from "bun";

// Define the data structure attached to every WebSocket connection
export interface WSData {
  ctx: InferContext<any>;
  [key: string]: any;
}

// Define the handlers for a WebSocket route
export interface WSHandlers<T = WSData> {
  open?: (ws: ServerWebSocket<T>) => void | Promise<void>;
  message?: (
    ws: ServerWebSocket<T>,
    message: string | Buffer
  ) => void | Promise<void>;
  close?: (
    ws: ServerWebSocket<T>,
    code: number,
    message: string
  ) => void | Promise<void>;
  drain?: (ws: ServerWebSocket<T>) => void | Promise<void>;
}

// Internal registry map
type WSRegistry = Map<string, WSHandlers>;

// Type augmentation for the App instance
export type BklarAppWithWS<T> = T & {
  ws: (path: string, handlers: WSHandlers) => BklarAppWithWS<T>;
  broadcast: (topic: string, data: string | Buffer) => void;
};

/**
 * Initializes WebSocket support for a Bklar application.
 *
 * @param app The Bklar application instance.
 * @returns The application instance augmented with `.ws()` method.
 */
export function websocket<App extends BklarApp<any>>(
  app: App
): BklarAppWithWS<App> {
  const wsRoutes: WSRegistry = new Map();
  let serverInstance: Server<any> | null = null;

  // 1. Attach the .ws() method to the app instance
  (app as any).ws = function (path: string, handlers: WSHandlers) {
    wsRoutes.set(path, handlers);

    // Register a standard HTTP GET route to handle the Upgrade
    this.get(path, (ctx: any) => {
      // "server" is injected into ctx.req by our custom listen handler below
      const server = ctx.req.rawServer as Server<any>;

      if (!server) {
        return ctx.json({ error: "WebSocket server not initialized" }, 500);
      }

      // Perform the upgrade
      // We pass the current Context (ctx) into the WebSocket data
      // This allows access to ctx.state (e.g., auth user) inside WS handlers
      const success = server.upgrade(ctx.req, {
        data: {
          _path: path,
          ctx,
        },
      });

      if (success) {
        // Bun handles the response from here
        return undefined;
      }

      return ctx.json({ error: "WebSocket upgrade failed" }, 400);
    });

    return this;
  };

  // 2. Attach a helper broadcast method
  (app as any).broadcast = function (topic: string, data: string | Buffer) {
    if (serverInstance) {
      serverInstance.publish(topic, data);
    }
  };

  // 3. Hijack the app.listen method to inject WebSocket handlers into Bun.serve
  const originalListen = app.listen.bind(app);

  app.listen = function (
    port: number | string,
    callback?: (server: Server<any>) => void
  ) {
    // We define the global websocket handler for Bun.serve
    // This dispatcher finds the specific handler based on the route path
    const websocketConfig = {
      open(ws: ServerWebSocket<any>) {
        const route = ws.data._path;
        const handler = wsRoutes.get(route);
        if (handler?.open) handler.open(ws);
      },
      message(ws: ServerWebSocket<any>, msg: string | Buffer) {
        const route = ws.data._path;
        const handler = wsRoutes.get(route);
        if (handler?.message) handler.message(ws, msg);
      },
      close(ws: ServerWebSocket<any>, code: number, reason: string) {
        const route = ws.data._path;
        const handler = wsRoutes.get(route);
        if (handler?.close) handler.close(ws, code, reason);
      },
      drain(ws: ServerWebSocket<any>) {
        const route = ws.data._path;
        const handler = wsRoutes.get(route);
        if (handler?.drain) handler.drain(ws);
      },
    };

    // Re-implement listen to pass 'websocket' and inject 'server' into fetch
    // Note: We use app.handle(req) but we MUST inject the server instance
    // into the request object so the GET handler above can access .upgrade()
    const options = (this as any).options || {};
    const logger = options.logger; // Reuse logger config if present

    serverInstance = Bun.serve({
      port: Number(port),
      websocket: websocketConfig,
      fetch: async (req, server) => {
        // Inject server instance into request for the Upgrade handler
        (req as any).rawServer = server;

        // Pass to standard Bklar handler
        return app.handle(req);
      },
      error: (err) => {
        console.error("🔥 Server Error:", err);
        return new Response("Internal Server Error", { status: 500 });
      },
    });

    console.log(
      `✅ Server (w/ WebSocket) listening on http://${serverInstance.hostname}:${serverInstance.port}`
    );

    if (callback) callback(serverInstance);
    return serverInstance;
  };

  return app as BklarAppWithWS<App>;
}
