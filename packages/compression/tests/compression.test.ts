import { describe, expect, it } from "bun:test";
import { Bklar } from "bklar";
import { compression } from "../src/index";

describe("Compression Middleware", () => {
  it("should compress large JSON responses with gzip", async () => {
    const app = Bklar({ logger: false });
    app.use(compression({ threshold: 10 })); // Low threshold for testing

    const largeData = { data: "a".repeat(1000) }; // ~1KB

    app.get("/", (ctx) => ctx.json(largeData));

    const res = await app.request("/", {
      headers: { "Accept-Encoding": "gzip" },
    });

    expect(res.headers.get("Content-Encoding")).toBe("gzip");
    expect(res.headers.get("Vary")).toBe("Accept-Encoding");

    // Verify content is actually compressed (smaller than original)
    const blob = await res.arrayBuffer();
    expect(blob.byteLength).toBeLessThan(1000);
  });

  it("should skip compression for small responses (threshold)", async () => {
    const app = Bklar({ logger: false });
    app.use(compression({ threshold: 1024 }));

    const smallData = { data: "tiny" };

    app.get("/", (ctx) => ctx.json(smallData));

    const res = await app.request("/", {
      headers: { "Accept-Encoding": "gzip" },
    });

    expect(res.headers.has("Content-Encoding")).toBe(false);

    const body = await res.json();
    expect(body).toEqual(smallData);
  });

  it("should respect Accept-Encoding", async () => {
    const app = Bklar({ logger: false });
    app.use(compression({ threshold: 0 }));

    app.get("/", (ctx) => ctx.text("content"));

    // Client doesn't ask for gzip
    const res = await app.request("/", {
      headers: { "Accept-Encoding": "identity" },
    });

    expect(res.headers.has("Content-Encoding")).toBe(false);
  });

  it("should skip incompressible content types (images)", async () => {
    const app = Bklar({ logger: false });
    app.use(compression({ threshold: 0 }));

    app.get("/image", (ctx) => {
      return new Response("fake-image-data", {
        headers: { "Content-Type": "image/jpeg" },
      });
    });

    const res = await app.request("/image", {
      headers: { "Accept-Encoding": "gzip" },
    });

    expect(res.headers.has("Content-Encoding")).toBe(false);
  });

  it("should support deflate", async () => {
    const app = Bklar({ logger: false });
    app.use(compression({ threshold: 0 }));
    app.get("/", (ctx) => ctx.text("A".repeat(100)));

    const res = await app.request("/", {
      headers: { "Accept-Encoding": "deflate" },
    });

    expect(res.headers.get("Content-Encoding")).toBe("deflate");
  });
});
