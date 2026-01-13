import { describe, expect, it, afterAll } from "bun:test";
import { Bklar } from "bklar";
import { websocket } from "../src/index";

describe("WebSocket Plugin", () => {
  let server: any;

  afterAll(() => {
    if (server) server.stop();
  });

  it("should upgrade connection and echo message", async () => {
    const app = websocket(Bklar({ logger: false }));
    const port = 4001;

    app.ws("/echo", {
      message(ws, msg) {
        ws.send(msg);
      },
    });

    server = app.listen(port);

    // Create Client
    const ws = new WebSocket(`ws://localhost:${port}/echo`);

    await new Promise<void>((resolve) => {
      ws.onopen = () => {
        ws.send("Hello Bun");
      };
      ws.onmessage = (event) => {
        expect(event.data).toBe("Hello Bun");
        ws.close();
        resolve();
      };
    });
  });

  it("should have access to context and query params", async () => {
    const app = websocket(Bklar({ logger: false }));
    const port = 4002;

    app.ws("/auth", {
      open(ws) {
        // Access query param from context
        const token = ws.data.ctx.query.token;
        ws.send(`Token: ${token}`);
      },
    });

    const srv = app.listen(port);

    const ws = new WebSocket(`ws://localhost:${port}/auth?token=123`);

    await new Promise<void>((resolve) => {
      ws.onmessage = (event) => {
        expect(event.data).toBe("Token: 123");
        ws.close();
        srv.stop();
        resolve();
      };
    });
  });

  it("should fail upgrade on non-ws routes", async () => {
    const app = websocket(Bklar({ logger: false }));
    const port = 4003;

    // Normal HTTP route
    app.get("/http", (ctx) => ctx.text("http"));

    const srv = app.listen(port);

    // Manually attempt handshake via fetch
    // If upgrade succeeds, status would be 101.
    // If it fails (handled as HTTP), it should be 200.
    const res = await fetch(`http://localhost:${port}/http`, {
      headers: {
        Connection: "Upgrade",
        Upgrade: "websocket",
        "Sec-WebSocket-Key": "dGhlIHNhbXBsZSBub25jZQ==",
        "Sec-WebSocket-Version": "13",
      },
    });

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("http");

    srv.stop();
  });
});
