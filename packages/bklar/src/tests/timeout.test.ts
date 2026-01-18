import { beforeEach, describe, expect, it } from "bun:test";
import { Bklar, type BklarApp as App } from "../app";

let app: App;

beforeEach(() => {
  app = Bklar({ logger: false });
});

describe("Timeout Support", () => {
  it("should complete if within timeout", async () => {
    app.get("/fast", async (ctx) => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return { success: true };
    }, { timeout: 200 });

    const res = await app.request("/fast");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("should timeout if handler takes too long", async () => {
    app.get("/slow", async (ctx) => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      return { success: true };
    }, { timeout: 100 });

    const res = await app.request("/slow");
    expect(res.status).toBe(504);
    const body = await res.json();
    expect(body.message).toBe("Gateway Timeout");
  });

  it("should provide an abort signal to the handler", async () => {
    let aborted = false;
    app.get("/abort", async (ctx) => {
      ctx.signal?.addEventListener("abort", () => {
        aborted = true;
      });
      await new Promise((resolve) => setTimeout(resolve, 300));
      return { success: true };
    }, { timeout: 100 });

    const res = await app.request("/abort");
    expect(res.status).toBe(504);
    expect(aborted).toBe(true);
  });

  it("should clear timeout if handler finishes", async () => {
    // This is hard to test directly from outside, but we can check if it works correctly
    app.get("/clear", async (ctx) => {
      return { success: true };
    }, { timeout: 1000 });

    const res = await app.request("/clear");
    expect(res.status).toBe(200);
  });
});
