import { beforeEach, describe, expect, it } from "bun:test";
import { z } from "zod";
import { Bklar, type BklarApp as App } from "../app";
import type { Middleware } from "../types";

let app: App;

beforeEach(() => {
  app = Bklar();
});

describe("Core Framework Tests", () => {
  describe("Basic Routing", () => {
    it("should handle a simple GET request", async () => {
      app.get("/health", (ctx) => ctx.json({ status: "ok" }));

      // Use the new request helper
      const res = await app.request("/health");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ status: "ok" });
    });

    it("should return 404 for a route that does not exist", async () => {
      const res = await app.request("/not-found");

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.message).toBe("Resource not found");
    });

    it("should differentiate between HTTP methods", async () => {
      app.post("/data", (ctx) => ctx.json({ created: true }));

      const res = await app.request("/data", { method: "GET" });
      expect(res.status).toBe(404);
    });
  });

  describe("Route Parameters", () => {
    it("should correctly parse URL parameters", async () => {
      app.get("/users/:id/posts/:postId", (ctx) => {
        return ctx.json({ params: ctx.params });
      });

      const res = await app.request("/users/123/posts/abc-456");
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.params).toEqual({ id: "123", postId: "abc-456" });
    });
  });

  describe("Validation", () => {
    it("should validate query parameters successfully", async () => {
      app.get("/search", (ctx) => ctx.json({ query: ctx.query }), {
        schemas: {
          query: z.object({ q: z.string() }),
        },
      });

      const res = await app.request("/search?q=bklar");
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.query.q).toBe("bklar");
    });

    it("should return 400 on failed query parameter validation", async () => {
      app.get("/search", (ctx) => ctx.json({}), {
        schemas: {
          query: z.object({ q: z.string().min(5) }),
        },
      });

      const res = await app.request("/search?q=bun");
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.message).toBe("Validation Error");
      expect(body.errors.query.q).toBeDefined();
    });

    it("should validate request body successfully", async () => {
      app.post("/users", (ctx) => ctx.json({ created: ctx.body }), {
        schemas: {
          body: z.object({ name: z.string(), email: z.string().email() }),
        },
      });

      const userData = { name: "John Doe", email: "john.doe@example.com" };
      const res = await app.request("/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userData),
      });

      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.created).toEqual(userData);
    });
  });

  describe("Middlewares and Groups", () => {
    it("should run a global middleware on every request", async () => {
      app.use(async (ctx, next) => {
        ctx.state.global = true;
        return next();
      });
      app.get("/test", (ctx) => ctx.json({ state: ctx.state }));

      const res = await app.request("/test");
      const body = await res.json();

      expect(body.state.global).toBe(true);
    });

    it("should run a route-specific middleware", async () => {
      const routeMiddleware: Middleware = async (ctx, next) => {
        ctx.state.routeSpecific = true;
        return next();
      };

      app.get("/profile", (ctx) => ctx.json({ state: ctx.state }), {
        middlewares: [routeMiddleware],
      });
      app.get("/home", (ctx) => ctx.json({ state: ctx.state }));

      const res1 = await app.request("/profile");
      const body1 = await res1.json();
      expect(body1.state.routeSpecific).toBe(true);

      const res2 = await app.request("/home");
      const body2 = await res2.json();
      expect(body2.state.routeSpecific).toBeUndefined();
    });
  });
});
