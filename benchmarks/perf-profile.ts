import { Bklar } from "bklar";
import { Context } from "../packages/bklar/src/context";
import { Router } from "../packages/bklar/src/router";
import { compose } from "../packages/bklar/src/utils/compose";
import type { Next } from "../packages/bklar/src/types";

const ITERATIONS = 200_000;
const WARMUP = 20_000;

function bench(name: string, fn: () => void | Promise<void>, iterations = ITERATIONS) {
  for (let i = 0; i < WARMUP; i++) fn();

  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  const elapsed = performance.now() - start;
  const opsPerSec = Math.round((iterations / elapsed) * 1000);
  const avgUs = ((elapsed / iterations) * 1000).toFixed(2);

  console.log(`  ${name.padEnd(48)} ${opsPerSec.toLocaleString().padStart(10)} ops/s  (${avgUs} µs/op)`);
  return { name, opsPerSec, avgUs };
}

async function runProfile() {
  console.log("\n🔬 Bklar Internal Pipeline Profiler");
  console.log(`   ${ITERATIONS.toLocaleString()} iterations, ${WARMUP.toLocaleString()} warmup`);
  console.log("=".repeat(80));

  // =========================================================================
  // 1. Context Creation
  // =========================================================================
  console.log("\n📊 1. Context Creation\n" + "-".repeat(40));

  const reqUrl = "http://localhost/test?foo=bar";
  const req = new Request(reqUrl, { headers: { "x-request-id": "existing-id" } });

  await bench("crypto.randomUUID() standalone", () => {
    crypto.randomUUID();
  });

  await bench("new URL(req.url) + searchParams", () => {
    const u = new URL(req.url);
    Object.fromEntries(u.searchParams.entries());
  });

  await bench("new Context() instantiation", () => {
    new Context(req, {}, undefined, "test-id", 0, "X-Request-Id");
  });

  // Simulate what _createContext does
  await bench("_createContext (full: uuid + url + ctx)", () => {
    const id = crypto.randomUUID();
    const u = new URL(req.url);
    const ctx = new Context(req, {}, undefined, id, 0, "X-Request-Id");
    ctx.query = Object.fromEntries(u.searchParams.entries());
  });

  await bench("_createContext (existing id from header)", () => {
    const existingId = req.headers.get("x-request-id");
    const u = new URL(req.url);
    const ctx = new Context(req, {}, undefined, existingId!, 0, "X-Request-Id");
    ctx.query = Object.fromEntries(u.searchParams.entries());
  });

  // =========================================================================
  // 2. Route Matching
  // =========================================================================
  console.log("\n📊 2. Route Matching\n" + "-".repeat(40));

  const router = new Router();

  // Static route
  router.add("GET", "/hello", [async (ctx, next) => next()], {});
  // Long static route
  router.add("GET", "/api/v1/users/profile", [async (ctx, next) => next()], {});
  // Param route
  router.add("GET", "/users/:id/posts/:postId", [async (ctx, next) => next()], {});

  await bench("router.find() static /hello", () => {
    router.find("GET", "/hello");
  });

  await bench("router.find() long static /api/v1/users/profile", () => {
    router.find("GET", "/api/v1/users/profile");
  });

  await bench("router.find() params /users/42/posts/99", () => {
    router.find("GET", "/users/42/posts/99");
  });

  await bench("router.find() 404 miss", () => {
    router.find("GET", "/nonexistent");
  });

  await bench("path.split + filter (3 segments)", () => {
    "/api/v1/users".split("/").filter(Boolean);
  });

  await bench("req.headers.get (existing header)", () => {
    req.headers.get("x-request-id");
  });

  await bench("req.headers.get (missing header)", () => {
    req.headers.get("x-missing");
  });

  // =========================================================================
  // 3. Middleware Composition
  // =========================================================================
  console.log("\n📊 3. Middleware Composition\n" + "-".repeat(40));

  const noopSync = (ctx: Context<any>, next: Next) => next();
  const noopAsync = async (ctx: Context<any>, next: Next) => { await next(); };

  const ctx3 = new Context(req, {}, undefined, "id", 0);

  // Compose construction overhead
  await bench("compose() construction (0 mw)", () => {
    compose([]);
  });

  await bench("compose() construction (3 mw)", () => {
    compose([noopAsync, noopAsync, noopAsync]);
  });

  await bench("compose() construction (10 mw)", () => {
    compose(Array(10).fill(noopAsync));
  });

  // Dispatch overhead
  const dispatch0 = compose([]);
  await bench("dispatch() 0 middlewares", async () => {
    await dispatch0(ctx3);
  });

  const dispatch1Sync = compose([noopSync]);
  await bench("dispatch() 1 sync middleware", async () => {
    await dispatch1Sync(ctx3);
  });

  const dispatch1Async = compose([noopAsync]);
  await bench("dispatch() 1 async middleware", async () => {
    await dispatch1Async(ctx3);
  });

  const dispatch3 = compose([noopAsync, noopAsync, noopAsync]);
  await bench("dispatch() 3 async middlewares", async () => {
    await dispatch3(ctx3);
  });

  const dispatch10 = compose(Array(10).fill(noopAsync));
  await bench("dispatch() 10 async middlewares", async () => {
    await dispatch10(ctx3);
  });

  // Async vs sync overhead
  const hSync = () => "hello";
  const hAsync = async () => "hello";
  await bench("sync handler → string return", () => {
    hSync();
  });
  await bench("async handler → string return", async () => {
    await hAsync();
  });

  // =========================================================================
  // 4. Response Normalization + Creation
  // =========================================================================
  console.log("\n📊 4. Response Normalization + Response Creation\n" + "-".repeat(40));

  const ctx4 = new Context(req, {}, undefined, "id", 0);

  await bench("ctx.text() full path", () => {
    ctx4.text("hello");
  });

  await bench("ctx.json() full path", () => {
    ctx4.json({ id: 1, name: "test" });
  });

  await bench("ctx.status(200)", () => {
    ctx4.status(200);
  });

  await bench("new Response(string, ...)", () => {
    new Response("hello", { status: 200, headers: { "Content-Type": "text/plain" } });
  });

  await bench("new Response(null, status)", () => {
    new Response(null, { status: 200 });
  });

  await bench("JSON.stringify(small obj)", () => {
    JSON.stringify({ id: 1, name: "test" });
  });

  // Simulate response normalization in handler wrapper
  await bench("typeof checks (res=string path)", () => {
    const res = "hello";
    if (typeof res === "string") { /* text path */ }
  });

  await bench("typeof checks (res=Response path)", () => {
    const r = new Response("hello");
    const res: any = r;
    if (res instanceof Response) { /* passthrough */ }
    else if (typeof res === "string") { }
    else if (typeof res === "object") { }
  });

  // Check order matters: instanceof Response first vs last
  const strRes: any = "hello";
  await bench("check string before Response", () => {
    if (typeof strRes === "string") { return; }
    if (strRes instanceof Response) { return; }
  });
  await bench("check Response before string", () => {
    if (strRes instanceof Response) { return; }
    if (typeof strRes === "string") { return; }
  });

  // =========================================================================
  // 5. Header Merging
  // =========================================================================
  console.log("\n📊 5. Header Merging\n" + "-".repeat(40));

  await bench("Headers().set() single", () => {
    const h = new Headers();
    h.set("X-Custom", "value");
  });

  await bench("new Headers() + forEach (empty)", () => {
    const h = new Headers();
    h.forEach((v, k) => { /* noop */ });
  });

  const headers5 = new Headers();
  for (let i = 0; i < 5; i++) headers5.set(`X-H${i}`, "v");
  await bench("new Headers() + forEach (5 items)", () => {
    const h = new Headers(headers5);
    h.forEach((v, k) => { /* noop */ });
  });

  const res5 = new Response("ok");
  await bench("merge 0 _headers into Response", () => {
    const empty = new Headers();
    empty.forEach((value, key) => {
      if (!res5.headers.has(key)) res5.headers.set(key, value);
    });
  });

  await bench("Headers().size read", () => {
    const h = new Headers();
    const s = h.size;
  });

  await bench("_appendRequestId (has id, header set)", () => {
    const h = new Headers();
    h.set("X-Request-Id", "test-123");
  });

  // =========================================================================
  // 6. Empty Guards / Fast Paths
  // =========================================================================
  console.log("\n📊 6. Empty Guards / Fast Paths\n" + "-".repeat(40));

  await bench("h?.onRequest (undefined)", () => {
    const hooks: any = undefined;
    let h = hooks?.onRequest;
  });

  await bench("h?.onRequest (present)", () => {
    const hooks: any = { onRequest: (c: any) => c };
    let h = hooks?.onRequest;
  });

  await bench("[].sort()", () => {
    const arr: { priority: number | undefined }[] = [];
    arr.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0)).map(m => (m as any).fn);
  });

  await bench("[].length check + skip sort", () => {
    const arr: { priority: number | undefined }[] = [];
    if (arr.length === 0) { /* skip */ }
  });

  await bench("performance.now()", () => {
    performance.now();
  });

  await bench("req.method + Upgrade header (non-WS)", () => {
    req.method === "GET" && req.headers.get("Upgrade")?.toLowerCase() === "websocket";
  });

  // =========================================================================
  // 7. Lazy Body Parsing
  // =========================================================================
  console.log("\n📊 7. Lazy Body Parsing\n" + "-".repeat(40));

  const getReq = new Request("http://localhost/test");
  await bench("parseBody() on GET (should no-op)", async () => {
    const ctx = new Context(getReq, {});
    await ctx.parseBody();
  });

  const postReq = new Request("http://localhost/data", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "alice", age: 30 }),
  });
  await bench("parseBody() POST JSON small body", async () => {
    const ctx = new Context(postReq, {});
    await ctx.parseBody();
  });

  // =========================================================================
  // 8. Static Route vs Param Route (end-to-end via app.request)
  // =========================================================================
  console.log("\n📊 8. Static vs Param Route (end-to-end via app.request)\n" + "-".repeat(40));

  const appStatic = Bklar({ logger: false });
  appStatic.get("/hello", () => "hello");

  const appParam = Bklar({ logger: false });
  appParam.get("/users/:id", (ctx) => `user ${ctx.params.id}`);

  await bench("app.request static /hello", () => {
    appStatic.request("/hello");
  });

  await bench("app.request param /users/42", () => {
    appParam.request("/users/42");
  });

  // =========================================================================
  // 9. Compose Caching Potential
  // =========================================================================
  console.log("\n📊 9. Compose Caching Potential\n" + "-".repeat(40));

  // Is compose per-request? Compare full handle path with precomposed dispatch
  const app9 = Bklar({ logger: false });
  app9.get("/fast", () => "hello");

  // Get the precomposed dispatch from the router
  const match9 = (app9 as any).router.find("GET", "/fast");
  const precomposed = compose(match9.handlers);

  await bench("handle: compose + dispatch (per-request)", async () => {
    const m = (app9 as any).router.find("GET", "/fast");
    const d = compose(m.handlers);
    const ctx = new Context(new Request("http://localhost/fast"), {});
    await d(ctx);
  });

  await bench("handle: precomposed dispatch only", async () => {
    const m = (app9 as any).router.find("GET", "/fast");
    const ctx = new Context(new Request("http://localhost/fast"), {});
    await precomposed(ctx);
  });

  // Compare: compose cost allocation
  await bench("compose allocation (3 mw) - measure", () => {
    const d = compose([noopAsync, noopAsync, noopAsync]);
    // prevent optimization from removing
    if (!d) throw new Error("unreachable");
  });

  // =========================================================================
  // Summary
  // =========================================================================
  console.log("=".repeat(80));
  console.log("✅ Profiling complete\n");
}

runProfile().catch(console.error);
