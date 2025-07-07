import { beforeEach, describe, expect, it } from "bun:test";
import { z } from "zod";
import type { App } from "../app";
import { createApp } from "../app";
import type { Middleware } from "../types";

let app: App;

beforeEach(() => {
  app = createApp();
});

describe("Core Framework Tests", () => {
  describe("Basic Routing", () => {
    it("should handle a simple GET request", async () => {
      app.get("/health", (ctx) => ctx.json({ status: "ok" }));

      const req = new Request("http://localhost/health");
      const res = await app.router.handle(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ status: "ok" });
    });

    it("should return 404 for a route that does not exist", async () => {
      const req = new Request("http://localhost/not-found");
      const res = await app.router.handle(req);

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.message).toBe("Route not found");
    });

    it("should differentiate between HTTP methods", async () => {
      app.post("/data", (ctx) => ctx.json({ created: true }));

      const req = new Request("http://localhost/data", { method: "GET" });
      const res = await app.router.handle(req);

      expect(res.status).toBe(404);
    });
  });

  describe("Route Parameters", () => {
    it("should correctly parse URL parameters", async () => {
      app.get("/users/:id/posts/:postId", (ctx) => {
        return ctx.json({ params: ctx.params });
      });

      const req = new Request("http://localhost/users/123/posts/abc-456");
      const res = await app.router.handle(req);
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

      const req = new Request("http://localhost/search?q=bun-framework");
      const res = await app.router.handle(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.query.q).toBe("bun-framework");
    });

    it("should return 400 on failed query parameter validation", async () => {
      app.get("/search", (ctx) => ctx.json({}), {
        schemas: {
          query: z.object({ q: z.string().min(5) }),
        },
      });

      const req = new Request("http://localhost/search?q=bun");
      const res = await app.router.handle(req);
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
      const req = new Request("http://localhost/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userData),
      });

      const res = await app.router.handle(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.created).toEqual(userData);
    });

    it("should return 400 on failed body validation", async () => {
      app.post("/users", (ctx) => ctx.json({}), {
        schemas: {
          body: z.object({ name: z.string(), email: z.string().email() }),
        },
      });

      const invalidData = { name: "Jane Doe" }; // Missing email
      const req = new Request("http://localhost/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invalidData),
      });

      const res = await app.router.handle(req);
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.errors.body.email).toBeDefined();
    });
  });

  describe("Middlewares and Groups", () => {
    it("should run a global middleware on every request", async () => {
      app.use((ctx) => {
        ctx.state.global = true;
      });
      app.get("/test", (ctx) => ctx.json({ state: ctx.state }));

      const req = new Request("http://localhost/test");
      const res = await app.router.handle(req);
      const body = await res.json();

      expect(body.state.global).toBe(true);
    });

    it("should run a route-specific middleware", async () => {
      const routeMiddleware: Middleware = (ctx) => {
        ctx.state.routeSpecific = true;
      };

      app.get("/profile", (ctx) => ctx.json({ state: ctx.state }), {
        middlewares: [routeMiddleware],
      });
      app.get("/home", (ctx) => ctx.json({ state: ctx.state }));

      const res1 = await app.router.handle(
        new Request("http://localhost/profile")
      );
      const body1 = await res1.json();
      expect(body1.state.routeSpecific).toBe(true);

      const res2 = await app.router.handle(
        new Request("http://localhost/home")
      );
      const body2 = await res2.json();
      expect(body2.state.routeSpecific).toBeUndefined();
    });

    it("should handle grouped routes with a group middleware", async () => {
      const authMiddleware: Middleware = (ctx) => {
        ctx.state.user = { id: 1 };
      };

      app.group(
        "/admin",
        (r) => {
          r.get("/dashboard", (ctx) => ctx.json({ state: ctx.state }));
        },
        [authMiddleware]
      );

      const req = new Request("http://localhost/admin/dashboard");
      const res = await app.router.handle(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.state.user).toEqual({ id: 1 });
    });

    it("should apply middlewares in correct order: global -> group -> route", async () => {
      const order: string[] = [];

      app.use(() => {
        order.push("global");
      });

      const groupMiddleware: Middleware = () => {
        order.push("group");
      };
      const routeMiddleware: Middleware = () => {
        order.push("route");
      };

      app.group(
        "/test",
        (r) => {
          r.get(
            "/order",
            () => {
              order.push("handler");
              return new Response(JSON.stringify({ order }));
            },
            { middlewares: [routeMiddleware] }
          );
        },
        [groupMiddleware]
      );

      const req = new Request("http://localhost/test/order");
      await app.router.handle(req);

      expect(order).toEqual(["global", "group", "route", "handler"]);
    });
  });
});
