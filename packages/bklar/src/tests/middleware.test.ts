import { beforeEach, describe, expect, it } from "bun:test";
import { Bklar, type BklarApp as App } from "../app";

let app: App;

beforeEach(() => {
  app = Bklar({ logger: false });
});

describe("Middleware Return Value Handling", () => {
  it("should fail with 500 without the fix, but pass with the fix", async () => {
    // 1. Add a "passive" global middleware that does NOT return next()
    app.use(async (ctx, next) => {
      console.log("Middleware: Before");
      await next();
      console.log("Middleware: After");
      // Intentionally missing: return next() or return res;
    });

    // 2. Add a standard route
    app.get("/test", (ctx) => {
      return ctx.json({ success: true });
    });

    // 3. Request
    const res = await app.request("/test");

    // Without fix: This returns 500 Internal Server Error
    // With fix: This returns 200 OK
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("should still allow middleware to override response", async () => {
    // Middleware that deliberately ignores next() result and returns something else
    app.use(async (ctx, next) => {
      await next();
      return ctx.json({ intercepted: true });
    });

    app.get("/override", (ctx) => ctx.json({ original: true }));

    const res = await app.request("/override");
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.intercepted).toBe(true);
    expect(body.original).toBeUndefined();
  });
});
