import { describe, expect, it } from "bun:test";
import { Bklar } from "bklar";
import { session, MemoryStore } from "../index";

describe("Session Middleware", () => {
  it("should create a new session and set a cookie", async () => {
    const app = Bklar({ logger: false });
    app.use(session());
    app.get("/", (ctx) => {
      return ctx.json({ sid: ctx.state.sessionId });
    });

    const res = await app.request("/");
    expect(res.status).toBe(200);
    expect(res.headers.has("Set-Cookie")).toBe(true);
  });

  it("should persist session data across requests", async () => {
    const store = new MemoryStore();
    const app = Bklar({ logger: false });
    app.use(session({ store }));
    app.get("/set", (ctx) => {
      ctx.state.session!.count = 1;
      return ctx.text("set");
    });
    app.get("/get", (ctx) => {
      return ctx.json({ count: ctx.state.session?.count });
    });

    const res1 = await app.request("/set");
    const cookie = res1.headers.get("Set-Cookie")!;

    const res2 = await app.request("/get", {
      headers: { Cookie: cookie },
    });
    expect(res2.status).toBe(200);
    const body = await res2.json();
    expect(body.count).toBe(1);
  });

  it("should create new session for expired/invalid sid", async () => {
    const app = Bklar({ logger: false });
    app.use(session({ maxAge: 1 }));
    app.get("/", (ctx) => {
      return ctx.json({ sid: ctx.state.sessionId });
    });

    const res = await app.request("/", {
      headers: { Cookie: "sid=invalid_session_id" },
    });
    expect(res.status).toBe(200);
  });

  it("should support MemoryStore clear", () => {
    const store = new MemoryStore();
    store.set("test", { foo: "bar" });
    expect(store.get("test")).toEqual({ foo: "bar" });
    store.clear();
    expect(store.get("test")).toBeNull();
  });

  it("should destroy a session", () => {
    const store = new MemoryStore();
    store.set("x", { val: 1 });
    store.destroy("x");
    expect(store.get("x")).toBeNull();
  });
});
