import { describe, expect, test } from "bun:test";
import { Bklar } from "../index";

describe("Context Download & Headers", () => {
  test("ctx.download serves file with correct headers", async () => {
    const app = Bklar();

    app.get("/download", (ctx) => {
      // Mock a file using Blob
      const file = new Blob(["hello world"], { type: "text/plain" });
      return ctx.download(file, "hello.txt");
    });

    const res = await app.request("/download");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/plain");
    expect(res.headers.get("Content-Disposition")).toBe(
      'attachment; filename="hello.txt"',
    );
    expect(await res.text()).toBe("hello world");
  });

  test("ctx.download defaults Content-Type to application/octet-stream", async () => {
    const app = Bklar();

    app.get("/download", (ctx) => {
      const file = new Blob(["binary"], { type: "" }); // No type
      return ctx.download(file);
    });

    const res = await app.request("/download");
    expect(res.headers.get("Content-Type")).toBe("application/octet-stream");
  });

  test("ctx.download merges persistent headers", async () => {
    const app = Bklar();

    // Middleware setting a header
    app.use(async (ctx, next) => {
      ctx.setHeader("X-Custom-Header", "persistent");
      return next();
    });

    app.get("/download", (ctx) => {
      const file = new Blob(["data"]);
      return ctx.download(file);
    });

    const res = await app.request("/download");
    expect(res.headers.get("X-Custom-Header")).toBe("persistent");
  });

  test("Manual Response inherits persistent headers and cookies", async () => {
    const app = Bklar();

    app.use(async (ctx, next) => {
      ctx.setHeader("X-Inherited", "true");
      ctx.setCookie("session", "123");
      return next();
    });

    app.get("/manual", () => {
      return new Response("manual");
    });

    const res = await app.request("/manual");
    expect(res.headers.get("X-Inherited")).toBe("true");

    // Check cookie
    // Bun's Response headers usually handle Set-Cookie via getSetCookie() or get()
    if (typeof res.headers.getSetCookie === "function") {
      const cookies = res.headers.getSetCookie();
      expect(cookies.some((c) => c.includes("session=123"))).toBe(true);
    } else {
      // Fallback check
      const cookieHeader = res.headers.get("Set-Cookie");
      expect(cookieHeader).toContain("session=123");
    }
  });

  test("Manual Response does not duplicate cookies if already present", async () => {
    const app = Bklar();

    app.use(async (ctx, next) => {
      ctx.setCookie("auth", "token");
      return next();
    });

    app.get("/manual-duplicate", () => {
      // Manually setting the same cookie
      return new Response("manual", {
        headers: {
          "Set-Cookie": "auth=token",
        },
      });
    });

    const res = await app.request("/manual-duplicate");
    
    if (typeof res.headers.getSetCookie === "function") {
        const cookies = res.headers.getSetCookie();
        // Should appear only once
        const authCookies = cookies.filter(c => c === "auth=token");
        expect(authCookies.length).toBe(1);
    }
  });
});
