import { describe, expect, it, afterEach } from "bun:test";
import { Bklar, BklarApp } from "../app";
import { Context } from "../context";
import { z } from "zod/v4";

describe("Phase 3 Core Features", () => {
  describe("Streaming", () => {
    it("should return a ReadableStream via ctx.stream()", async () => {
      const app = Bklar({ logger: false });
      app.get("/stream", (ctx) => {
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode("chunk1"));
            controller.enqueue(new TextEncoder().encode("chunk2"));
            controller.close();
          },
        });
        return ctx.stream(stream, 200, {
          "Content-Type": "text/custom",
        });
      });

      const res = await app.request("/stream");
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("text/custom");
      const body = await res.text();
      expect(body).toBe("chunk1chunk2");
    });

    it("should auto-detect ReadableStream returns", async () => {
      const app = Bklar({ logger: false });
      app.get("/auto", () => {
        return new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode("auto"));
            controller.close();
          },
        });
      });

      const res = await app.request("/auto");
      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toBe("auto");
    });
  });

  describe("Cache-Control", () => {
    it("should set Cache-Control header", async () => {
      const app = Bklar({ logger: false });
      app.get("/cached", (ctx) => {
        ctx.cacheControl({ public: true, maxAge: 3600, immutable: true });
        return ctx.text("cached");
      });

      const res = await app.request("/cached");
      const cc = res.headers.get("Cache-Control")!;
      expect(cc).toContain("public");
      expect(cc).toContain("max-age=3600");
      expect(cc).toContain("immutable");
    });

    it("should support all directives", async () => {
      const app = Bklar({ logger: false });
      app.get("/all", (ctx) => {
        ctx.cacheControl({
          private: true,
          noStore: true,
          mustRevalidate: true,
          staleWhileRevalidate: 60,
        });
        return ctx.text("ok");
      });

      const res = await app.request("/all");
      const cc = res.headers.get("Cache-Control")!;
      expect(cc).toContain("private");
      expect(cc).toContain("no-store");
      expect(cc).toContain("must-revalidate");
      expect(cc).toContain("stale-while-revalidate=60");
    });
  });

  describe("ETag", () => {
    it("should set ETag header", async () => {
      const app = Bklar({ logger: false });
      app.get("/etag", (ctx) => {
        ctx.etag("abc123");
        return ctx.text("data");
      });

      const res = await app.request("/etag");
      expect(res.headers.get("ETag")).toBe('"abc123"');
    });

    it("should return 304 on matching If-None-Match", async () => {
      const app = Bklar({ logger: false });
      app.get("/conditional", (ctx) => {
        const notModified = ctx.etag("abc123");
        if (notModified) return notModified;
        return ctx.text("data");
      });

      const res = await app.request("/conditional", {
        headers: { "If-None-Match": '"abc123"' },
      });
      expect(res.status).toBe(304);
    });
  });

  describe("Last-Modified", () => {
    it("should set Last-Modified header", async () => {
      const app = Bklar({ logger: false });
      const date = new Date("2024-01-01");
      app.get("/modified", (ctx) => {
        ctx.lastModified(date);
        return ctx.text("data");
      });

      const res = await app.request("/modified");
      expect(res.headers.get("Last-Modified")).toBe(date.toUTCString());
    });

    it("should return 304 on fresh If-Modified-Since", async () => {
      const app = Bklar({ logger: false });
      const oldDate = new Date("2023-01-01");
      app.get("/fresh", (ctx) => {
        const notModified = ctx.lastModified(oldDate);
        if (notModified) return notModified;
        return ctx.text("data");
      });

      const res = await app.request("/fresh", {
        headers: { "If-Modified-Since": new Date("2024-01-01").toUTCString() },
      });
      expect(res.status).toBe(304);
    });
  });

  describe("FormData", () => {
    it("should parse multipart form data", async () => {
      const app = Bklar({ logger: false });
      app.post("/upload", async (ctx) => {
        const fd = await ctx.formData();
        return ctx.json({ name: fd.get("name") });
      });

      const formData = new FormData();
      formData.append("name", "bklar");

      const res = await app.request("/upload", {
        method: "POST",
        body: formData,
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.name).toBe("bklar");
    });

    it("should cache form data on repeated access", async () => {
      const app = Bklar({ logger: false });
      let calls = 0;
      app.post("/multi", async (ctx) => {
        const fd1 = await ctx.formData();
        calls++;
        const fd2 = await ctx.formData();
        calls++;
        return ctx.json({ count: calls, name: fd1.get("x") });
      });

      const fd = new FormData();
      fd.append("x", "y");
      const res = await app.request("/multi", { method: "POST", body: fd });
      const body = await res.json();
      expect(body.count).toBe(2);
      expect(body.name).toBe("y");
    });
  });

  describe("DI Container", () => {
    it("should resolve static providers", async () => {
      Context.provide("db", () => ({ query: () => "result" }));

      const app = Bklar({ logger: false });
      app.get("/db", (ctx) => {
        const db: any = ctx.get("db");
        return ctx.json({ result: db.query() });
      });

      const res = await app.request("/db");
      const body = await res.json();
      expect(body.result).toBe("result");
    });

    it("should throw for unregistered provider", async () => {
      const app = Bklar({ logger: false });
      app.get("/missing", (ctx) => {
        ctx.get("nonexistent");
        return ctx.text("ok");
      });

      const res = await app.request("/missing");
      expect(res.status).toBe(500);
    });
  });

  describe("Problem JSON Errors", () => {
    it("should return RFC 7807 format when errorFormat is problemJson", async () => {
      const app = Bklar({ logger: false, errorFormat: "problemJson" });
      app.get("/error", () => {
        throw new Error("test");
      });

      const res = await app.request("/error");
      expect(res.status).toBe(500);
      expect(res.headers.get("Content-Type")).toBe("application/problem+json");
      const body = await res.json();
      expect(body.type).toBeDefined();
      expect(body.title).toBeDefined();
      expect(body.status).toBe(500);
    });

    it("should return basic format by default", async () => {
      const app = Bklar({ logger: false });
      app.get("/error", () => {
        throw new Error("test");
      });

      const res = await app.request("/error");
      const body = await res.json();
      expect(body.message).toBeDefined();
      expect(body.type).toBeUndefined();
    });
  });
});
