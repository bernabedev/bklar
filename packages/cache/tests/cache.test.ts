import { describe, expect, it, beforeEach } from "bun:test";
import { Bklar } from "bklar";
import { cache, MemoryStore } from "../src/index";

describe("Cache Middleware", () => {
  let app: ReturnType<typeof Bklar>;
  let store: MemoryStore;

  beforeEach(() => {
    app = Bklar({ logger: false });
    store = new MemoryStore();
  });

  it("should cache a GET request (MISS then HIT)", async () => {
    app.use(cache({ store, ttl: 1000 }));

    let counter = 0;
    app.get("/data", (ctx) => {
      counter++;
      return ctx.json({ counter });
    });

    // 1. First Request (MISS)
    const res1 = await app.request("/data");
    const body1 = await res1.json();

    expect(res1.headers.get("X-Cache")).toBe("MISS");
    expect(body1.counter).toBe(1);

    // 2. Second Request (HIT)
    const res2 = await app.request("/data");
    const body2 = await res2.json();

    expect(res2.headers.get("X-Cache")).toBe("HIT");
    expect(body2.counter).toBe(1); // Should still be 1 (cached)
    expect(counter).toBe(1); // Handler should not have run again
  });

  it("should expire after TTL", async () => {
    app.use(cache({ store, ttl: 100 })); // 100ms TTL

    app.get("/ttl", (ctx) => ctx.json({ time: Date.now() }));

    const res1 = await app.request("/ttl");
    const body1 = await res1.json();

    // Wait for expiration
    await new Promise((r) => setTimeout(r, 150));

    const res2 = await app.request("/ttl");
    const body2 = await res2.json();

    expect(res2.headers.get("X-Cache")).toBe("MISS");
    expect(body2.time).not.toBe(body1.time);
  });

  it("should return 304 if ETag matches", async () => {
    app.use(cache({ store }));
    app.get("/etag", (ctx) => ctx.text("content"));

    // Populate cache
    const res1 = await app.request("/etag");
    const etag = res1.headers.get("ETag");
    expect(etag).toBeDefined();

    // Request with If-None-Match
    const res2 = await app.request("/etag", {
      headers: { "If-None-Match": etag! },
    });

    expect(res2.status).toBe(304);
    expect(await res2.text()).toBe(""); // Empty body
  });

  it("should skip caching for non-GET methods by default", async () => {
    app.use(cache({ store }));

    let counter = 0;
    app.post("/post", (ctx) => {
      counter++;
      return ctx.json({ counter });
    });

    await app.request("/post", { method: "POST" });
    const res = await app.request("/post", { method: "POST" });

    expect(res.headers.has("X-Cache")).toBe(false);
    expect(counter).toBe(2);
  });

  it("should generate consistent keys for query params", async () => {
    app.use(cache({ store }));

    let counter = 0;
    app.get("/query", () => {
      counter++;
      return new Response("ok");
    });

    // Request A: ?a=1&b=2
    await app.request("/query?a=1&b=2");

    // Request B: ?b=2&a=1 (Same logic, different order)
    const res = await app.request("/query?b=2&a=1");

    expect(res.headers.get("X-Cache")).toBe("HIT");
    expect(counter).toBe(1);
  });
});
