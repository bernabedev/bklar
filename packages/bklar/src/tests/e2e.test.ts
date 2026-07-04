import { describe, expect, it, afterEach } from "bun:test";
import { Bklar, BklarApp } from "../app";
import { z } from "zod/v4";

let servers: Array<ReturnType<BklarApp["listen"]>> = [];

afterEach(() => {
  for (const s of servers) {
    try { s.stop(false); } catch {}
  }
  servers = [];
});

function noThrowStop(s: ReturnType<BklarApp["listen"]>) {
  servers.push(s);
  return s;
}

describe("E2E Integration Tests", () => {
  describe("Request Lifecycle", () => {
    it("should handle GET requests with real fetch", async () => {
      const app = Bklar({ logger: false });
      app.get("/hello", () => ({ message: "world" }));
      const server = noThrowStop(app.listen(0));

      const res = await fetch(`http://localhost:${server.port}/hello`);
      expect(res.status).toBe(200);
      expect(res.headers.get("X-Request-Id")).toBeTruthy();
      const body = await res.json();
      expect(body.message).toBe("world");
      server.stop(false);
    });

    it("should handle POST with JSON body (with validation)", async () => {
      const app = Bklar({ logger: false });
      app.post("/echo", (ctx) => ctx.body, {
        schemas: { body: z.any() },
      });
      const server = noThrowStop(app.listen(0));

      const res = await fetch(`http://localhost:${server.port}/echo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ foo: "bar" }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.foo).toBe("bar");
      server.stop(false);
    });

    it("should return 404 for unknown routes", async () => {
      const app = Bklar({ logger: false });
      const server = noThrowStop(app.listen(0));

      const res = await fetch(`http://localhost:${server.port}/nope`);
      expect(res.status).toBe(404);
      server.stop(false);
    });

    it("should include Server-Timing when used", async () => {
      const app = Bklar({ logger: false });
      app.get("/", (ctx) => {
        ctx.serverTiming("db", 15, "Database");
        return "ok";
      });
      const server = noThrowStop(app.listen(0));

      const res = await fetch(`http://localhost:${server.port}/`);
      expect(res.headers.get("Server-Timing")).toContain("db");
      expect(res.headers.get("Server-Timing")).toContain("Database");
      server.stop(false);
    });
  });

  describe("SSE Streaming", () => {
    it("should stream SSE events", async () => {
      const app = Bklar({ logger: false });
      app.get("/events", async (ctx) => {
        const sse = ctx.sse();
        sse.id("1");
        sse.send("ping", JSON.stringify({ t: Date.now() }));
        sse.close();
        return undefined as any;
      });
      const server = noThrowStop(app.listen(0));

      const res = await fetch(`http://localhost:${server.port}/events`);
      expect(res.headers.get("Content-Type")).toBe("text/event-stream");
      const body = await res.text();
      expect(body).toContain("event: ping");
      expect(body).toContain('id: 1');
      server.stop(false);
    });
  });

  describe("Error Handling", () => {
    it("should return error as JSON for thrown errors", async () => {
      const app = Bklar({ logger: false });
      app.get("/boom", () => { throw new Error("kaboom"); });
      const server = noThrowStop(app.listen(0));

      const res = await fetch(`http://localhost:${server.port}/boom`);
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.message).toBeDefined();
      server.stop(false);
    });

    it("should return 400 for validation errors", async () => {
      const app = Bklar({ logger: false });
      app.post("/user", (ctx) => ctx.body, {
        schemas: { body: z.object({ name: z.string() }) },
      });
      const server = noThrowStop(app.listen(0));

      const res = await fetch(`http://localhost:${server.port}/user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: 123 }),
      });
      expect(res.status).toBe(400);
      server.stop(false);
    });

    it("should return 413 for oversized bodies", async () => {
      const app = Bklar({ logger: false, maxBodySize: 10 });
      app.post("/data", (ctx) => ctx.body);
      const server = noThrowStop(app.listen(0));

      const res = await fetch(`http://localhost:${server.port}/data`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": "100",
        },
        body: JSON.stringify({ data: "x".repeat(100) }),
      });
      expect(res.status).toBe(413);
      server.stop(false);
    });
  });

  describe("Graceful Shutdown", () => {
    it("should stop accepting requests after stop()", async () => {
      const app = Bklar({ logger: false }) as BklarApp;
      app.get("/", () => "ok");
      const server = noThrowStop(app.listen(0));

      const res = await fetch(`http://localhost:${server.port}/`);
      expect(res.status).toBe(200);

      await app.stop(100);

      let fetchFailed = false;
      try {
        await fetch(`http://localhost:${server.port}/`);
      } catch {
        fetchFailed = true;
      }
      expect(fetchFailed).toBe(true);
    });
  });

  describe("Lifecycle Hooks", () => {
    it("should fire onStart hook on listen", () => {
      let started = false;
      const app = Bklar({
        logger: false,
        hooks: {
          onStart: () => { started = true; },
        },
      });
      const server = app.listen(0);
      servers.push(server);
      expect(started).toBe(true);
      server.stop(false);
    });

    it("should fire onResponse hook for every request", async () => {
      let responseCount = 0;
      const app = Bklar({
        logger: false,
        hooks: {
          onResponse: () => { responseCount++; },
        },
      });
      const server = noThrowStop(app.listen(0));

      await fetch(`http://localhost:${server.port}/`);
      server.stop(false);

      // Wait for the hook to fire (happens after response is sent)
      await new Promise(r => setTimeout(r, 20));
      expect(responseCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Middleware Priority", () => {
    it("should maintain order when mixed priorities used in real server", async () => {
      const order: string[] = [];
      const app = Bklar({ logger: false });
      app.use(async (_, next) => { order.push("C"); return next(); }, 100);
      app.use(async (_, next) => { order.push("A"); return next(); }, -100);
      app.use(async (_, next) => { order.push("B"); return next(); }, 0);
      app.get("/", () => { order.push("H"); return "ok"; });
      const server = noThrowStop(app.listen(0));

      await fetch(`http://localhost:${server.port}/`);
      expect(order).toEqual(["A", "B", "C", "H"]);
      server.stop(false);
    });
  });
});
