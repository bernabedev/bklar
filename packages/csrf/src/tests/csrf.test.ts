import { describe, expect, it } from "bun:test";
import { Bklar } from "bklar";
import { csrf } from "../index";

describe("CSRF Middleware", () => {
  it("should set a CSRF cookie on GET requests", async () => {
    const app = Bklar({ logger: false });
    app.use(csrf());
    app.get("/", (ctx) => ctx.text("ok"));

    const res = await app.request("/");
    expect(res.status).toBe(200);
    const setCookie = res.headers.get("Set-Cookie") || "";
    expect(setCookie).toContain("csrf-token");
  });

  it("should allow GET/HEAD/OPTIONS without token validation", async () => {
    const app = Bklar({ logger: false });
    app.use(csrf());
    app.get("/", () => "ok");

    const res = await app.request("/");
    expect(res.status).toBe(200);
  });

  it("should reject POST without token", async () => {
    const app = Bklar({ logger: false });
    app.use(csrf());
    app.post("/", () => "ok");

    const res = await app.request("/", { method: "POST" });
    expect(res.status).toBe(403);
  });

  it("should accept POST with valid header token", async () => {
    const app = Bklar({ logger: false });
    app.use(csrf({ httpOnly: false }));
    app.get("/token", (ctx) => ctx.text("ok"));
    app.post("/action", (ctx) => ctx.text("done"));

    // First request to get the cookie token
    const getRes = await app.request("/token");
    const cookie = getRes.headers.get("Set-Cookie")!;
    const cookieToken = cookie.match(/csrf-token=([^;]+)/)?.[1];

    const res = await app.request("/action", {
      method: "POST",
      headers: {
        Cookie: cookie,
        "X-CSRF-Token": cookieToken!,
      },
    });
    expect(res.status).toBe(200);
  });

  it("should reject POST with wrong token", async () => {
    const app = Bklar({ logger: false });
    app.use(csrf({ httpOnly: false }));
    app.get("/token", (ctx) => ctx.text("ok"));
    app.post("/action", (ctx) => ctx.text("done"));

    const getRes = await app.request("/token");
    const cookie = getRes.headers.get("Set-Cookie")!;

    const res = await app.request("/action", {
      method: "POST",
      headers: {
        Cookie: cookie,
        "X-CSRF-Token": "wrong-token",
      },
    });
    expect(res.status).toBe(403);
  });

  it("should expose token in context state", async () => {
    const app = Bklar({ logger: false });
    let capturedToken = "";
    app.use(csrf());
    app.get("/", (ctx) => {
      capturedToken = ctx.state.csrfToken || "";
      return ctx.text("ok");
    });

    await app.request("/");
    expect(capturedToken.length).toBe(64);
  });
});
