import { describe, expect, it, afterEach } from "bun:test";
import { Bklar, BklarApp } from "../app";
import { Context } from "../context";
import { z } from "zod/v4";

describe("New Core Features", () => {
  describe("SSE Support", () => {
    it("should set correct SSE headers and stream events", async () => {
      const app = Bklar({ logger: false });
      app.get("/events", (ctx) => {
        const sse = ctx.sse();
        sse.id("1");
        sse.send("message", JSON.stringify({ text: "hello" }));
        sse.send("message", JSON.stringify({ text: "world" }));
        sse.close();
        return undefined as any;
      });

      const res = await app.request("/events");
      expect(res.headers.get("Content-Type")).toBe("text/event-stream");
      expect(res.headers.get("Cache-Control")).toBe("no-cache");
      expect(res.headers.get("Connection")).toBe("keep-alive");

      const body = await res.text();
      expect(body).toContain("id: 1");
      expect(body).toContain("event: message");
      expect(body).toContain('data: {"text":"hello"}');
      expect(body).toContain('data: {"text":"world"}');
    });

    it("should return false from send after close", async () => {
      const app = Bklar({ logger: false });
      app.get("/events", (ctx) => {
        const sse = ctx.sse();
        sse.send("e", "d");
        sse.close();
        const result = sse.send("e2", "d2");
        expect(result).toBe(false);
        return undefined as any;
      });

      await app.request("/events");
    });

    it("should include request ID in SSE response headers", async () => {
      const app = Bklar({ logger: false });
      app.get("/events", (ctx) => {
        const sse = ctx.sse();
        sse.close();
        return undefined as any;
      });

      const res = await app.request("/events");
      expect(res.headers.has("X-Request-Id")).toBe(true);
    });
  });

  describe("Request ID", () => {
    it("should generate a request ID and add it to response headers", async () => {
      const app = Bklar({ logger: false });
      app.get("/", (ctx) => ctx.text("ok"));

      const res = await app.request("/");
      expect(res.headers.has("X-Request-Id")).toBe(true);
      expect(res.headers.get("X-Request-Id")!.length).toBeGreaterThan(0);
    });

    it("should use existing request ID from header", async () => {
      const app = Bklar({ logger: false });
      app.get("/", (ctx) => {
        expect(ctx.requestId).toBe("my-custom-id");
        return ctx.text("ok");
      });

      await app.request("/", {
        headers: { "X-Request-Id": "my-custom-id" },
      });
    });

    it("should support custom header name and generator", async () => {
      const app = Bklar({
        logger: false,
        requestId: {
          headerName: "X-Correlation-Id",
          generator: () => "gen-" + Date.now(),
        },
      });
      let capturedId = "";
      app.get("/", (ctx) => {
        capturedId = ctx.requestId;
        return ctx.text("ok");
      });

      const res = await app.request("/");
      expect(capturedId).toStartWith("gen-");
      expect(res.headers.has("X-Correlation-Id")).toBe(true);
    });
  });

  describe("Body Size Limits", () => {
    it("should accept body under maxBodySize", async () => {
      const app = Bklar({ logger: false, maxBodySize: 1024 });
      app.post("/", (ctx) => ctx.json({ received: ctx.body }));

      const res = await app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ foo: "bar" }),
      });
      expect(res.status).toBe(200);
    });

    it("should return 413 for body exceeding Content-Length", async () => {
      const app = Bklar({ logger: false, maxBodySize: 10 });
      app.post("/", (ctx) => ctx.json({ received: ctx.body }));

      const largeBody = JSON.stringify({ data: "a".repeat(100) });
      const res = await app.request("/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": largeBody.length.toString(),
        },
        body: largeBody,
      });
      expect(res.status).toBe(413);
    });

    it("should return 413 for streamed body exceeding limit with validation", async () => {
      const app = Bklar({ logger: false, maxBodySize: 10 });
      app.post("/", (ctx) => ctx.json({ received: ctx.body }), {
        schemas: { body: z.any() },
      });

      const largeBody = JSON.stringify({ data: "a".repeat(100) });
      const res = await app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: largeBody,
      });
      expect(res.status).toBe(413);
    });
  });

  describe("Middleware Priority", () => {
    it("should execute middlewares in priority order", async () => {
      const executionOrder: string[] = [];
      const app = Bklar({ logger: false });

      app.use(async (ctx, next) => {
        executionOrder.push("C");
        return next();
      }, 10);

      app.use(async (ctx, next) => {
        executionOrder.push("A");
        return next();
      }, -10);

      app.use(async (ctx, next) => {
        executionOrder.push("B");
        return next();
      }, 0);

      app.get("/", () => {
        executionOrder.push("handler");
        return "ok";
      });

      await app.request("/");
      expect(executionOrder).toEqual(["A", "B", "C", "handler"]);
    });

    it("should default to registration order when no priority set", async () => {
      const executionOrder: string[] = [];
      const app = Bklar({ logger: false });

      app.use(async (ctx, next) => {
        executionOrder.push("1");
        return next();
      });
      app.use(async (ctx, next) => {
        executionOrder.push("2");
        return next();
      });
      app.use(async (ctx, next) => {
        executionOrder.push("3");
        return next();
      });

      app.get("/", () => {
        executionOrder.push("h");
        return "ok";
      });

      await app.request("/");
      expect(executionOrder).toEqual(["1", "2", "3", "h"]);
    });
  });

  describe("Server Timing", () => {
    it("should include Server-Timing header when timing entries exist", async () => {
      const app = Bklar({ logger: false });
      app.get("/", (ctx) => {
        ctx.serverTiming("db", 5, "Database query");
        ctx.serverTiming("cache", 1);
        return ctx.text("ok");
      });

      const res = await app.request("/");
      const timing = res.headers.get("Server-Timing");
      expect(timing).toContain("db");
      expect(timing).toContain('desc="Database query"');
      expect(timing).toContain("dur=5");
      expect(timing).toContain("cache");
      expect(timing).toContain("dur=1");
    });

    it("should omit Server-Timing when no entries", async () => {
      const app = Bklar({ logger: false });
      app.get("/", (ctx) => ctx.text("ok"));

      const res = await app.request("/");
      expect(res.headers.has("Server-Timing")).toBe(false);
    });

    it("ctx.time() should measure and add timing", async () => {
      const app = Bklar({ logger: false });
      app.get("/", async (ctx) => {
        await ctx.time("async-op", () => new Promise((r) => setTimeout(r, 20)));
        ctx.time("sync-op", () => {
          let x = 0;
          for (let i = 0; i < 1000; i++) x += i;
        });
        return ctx.text("ok");
      });

      const res = await app.request("/");
      const timing = res.headers.get("Server-Timing")!;
      expect(timing).toContain("async-op");
      expect(timing).toContain("sync-op");
    });
  });

  describe("Response Schema Validation", () => {
    const userSchema = z.object({
      id: z.number(),
      name: z.string(),
    });

    it("should pass validation for correct response", async () => {
      const app = Bklar({ logger: false });
      app.get("/user", () => ({ id: 1, name: "Alice" }), {
        responses: { 200: userSchema },
      });

      const res = await app.request("/user");
      expect(res.status).toBe(200);
    });

    it("should not crash on mismatched response (logs warning)", async () => {
      const app = Bklar({ logger: false });
      app.get("/user", () => ({ id: "wrong", name: "Bob" }), {
        responses: { 200: userSchema },
      });

      const res = await app.request("/user");
      expect(res.status).toBe(200);
    });
  });

  describe("Graceful Shutdown", () => {
    it("should stop listening and track stopping state", async () => {
      const app = Bklar({ logger: false }) as BklarApp;
      app.get("/", () => "ok");

      // Use request() which doesn't need listen
      expect(app.isStopping).toBe(false);
      await app.stop(100);
      expect(app.isStopping).toBe(true);
    });

    it("should return 503 when stopping", async () => {
      const app = Bklar({ logger: false }) as BklarApp;
      app.get("/", () => "ok");

      await app.stop(0);
      const res = await app.request("/");
      expect(res.status).toBe(503);
    });

    it("should track active requests count", async () => {
      const app = Bklar({ logger: false }) as BklarApp;
      app.get("/", () => "ok");

      expect(app.activeRequests).toBe(0);
      await app.request("/");
      expect(app.activeRequests).toBe(0);
    });
  });

  describe("Lifecycle Hooks", () => {
    it("should call onRequest and onResponse hooks", async () => {
      const requestCalls: string[] = [];
      const responseCalls: { status: number }[] = [];

      const app = Bklar({
        logger: false,
        hooks: {
          onRequest: (ctx) => {
            requestCalls.push(ctx.requestId);
          },
          onResponse: (ctx, res) => {
            responseCalls.push({ status: res.status });
          },
        },
      });
      app.get("/", () => "ok");

      await app.request("/");
      expect(requestCalls.length).toBe(1);
      expect(responseCalls.length).toBe(1);
      expect(responseCalls[0].status).toBe(200);
    });

    it("should call onResponse even for error responses", async () => {
      const hooksCalled: string[] = [];

      const app = Bklar({
        logger: false,
        hooks: {
          onResponse: () => {
            hooksCalled.push("response");
          },
        },
      });
      app.get("/", () => {
        throw new Error("boom");
      });

      const res = await app.request("/");
      expect(res.status).toBe(500);
      expect(hooksCalled).toContain("response");
    });
  });

  describe("WebSocket Rooms", () => {
    it("should support app.join and app.to.sendText", () => {
      const app = Bklar({ logger: false });
      const mockWs = { sendText: (data: string) => {} };

      app.join(mockWs, "room-a");
      // Should not throw
      app.to("room-a").sendText("hello");
    });
  });
});
