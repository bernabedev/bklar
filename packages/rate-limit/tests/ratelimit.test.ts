import { describe, expect, it } from "bun:test";
import { Bklar } from "bklar";
import { rateLimit } from "../src/index";

describe("Rate Limit Middleware", () => {
  it("should allow requests within limit", async () => {
    const app = Bklar({ logger: false });
    app.use(rateLimit({ max: 2, windowMs: 1000 }));
    app.get("/", (ctx) => ctx.text("ok"));

    const res1 = await app.request("/", {
      headers: { "X-Client-IP": "1.1.1.1" },
    });
    expect(res1.status).toBe(200);
    expect(res1.headers.get("X-RateLimit-Remaining")).toBe("1");

    const res2 = await app.request("/", {
      headers: { "X-Client-IP": "1.1.1.1" },
    });
    expect(res2.status).toBe(200);
    expect(res2.headers.get("X-RateLimit-Remaining")).toBe("0");
  });

  it("should block requests exceeding limit", async () => {
    const app = Bklar({ logger: false });
    app.use(rateLimit({ max: 1, windowMs: 1000 }));
    app.get("/", (ctx) => ctx.text("ok"));

    await app.request("/", { headers: { "X-Client-IP": "2.2.2.2" } }); // 1st OK

    const resBlocked = await app.request("/", {
      headers: { "X-Client-IP": "2.2.2.2" },
    }); // 2nd Blocked
    expect(resBlocked.status).toBe(429);

    const body = await resBlocked.json();
    expect(body.message).toBe("Too many requests, please try again later.");

    // Ensure headers are present on error response
    expect(resBlocked.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(resBlocked.headers.has("Retry-After")).toBe(true);
  });

  it("should use independent counters for different instances", async () => {
    const app = Bklar({ logger: false });

    // Strict limiter
    const strict = rateLimit({ max: 1, windowMs: 1000 });
    // Loose limiter
    const loose = rateLimit({ max: 5, windowMs: 1000 });

    app.get("/strict", (ctx) => ctx.text("strict"), { middlewares: [strict] });
    app.get("/loose", (ctx) => ctx.text("loose"), { middlewares: [loose] });

    // Hit strict twice
    await app.request("/strict", { headers: { "X-Client-IP": "3.3.3.3" } });
    const strictRes = await app.request("/strict", {
      headers: { "X-Client-IP": "3.3.3.3" },
    });
    expect(strictRes.status).toBe(429);

    // Hit loose twice (should still pass because it's a separate instance/map)
    await app.request("/loose", { headers: { "X-Client-IP": "3.3.3.3" } });
    const looseRes = await app.request("/loose", {
      headers: { "X-Client-IP": "3.3.3.3" },
    });
    expect(looseRes.status).toBe(200);
  });

  it("should support custom key generator", async () => {
    const app = Bklar({ logger: false });
    app.use(
      rateLimit({
        max: 1,
        keyGenerator: (ctx) => ctx.req.headers.get("Authorization") || "none",
      })
    );
    app.get("/", (ctx) => ctx.text("ok"));

    // User A
    const resA = await app.request("/", {
      headers: { Authorization: "UserA" },
    });
    expect(resA.status).toBe(200);

    // User B (Should pass even if IP is same, because key is Auth header)
    const resB = await app.request("/", {
      headers: { Authorization: "UserB" },
    });
    expect(resB.status).toBe(200);

    // User A again (Fail)
    const resAFail = await app.request("/", {
      headers: { Authorization: "UserA" },
    });
    expect(resAFail.status).toBe(429);
  });
});
