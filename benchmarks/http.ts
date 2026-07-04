import { Bklar } from "bklar";
import { Hono } from "hono";
import { Elysia, t } from "elysia";
import { z } from "zod/v4";
import type { Server } from "bun";

const REQ_PER_TEST = 50_000;
const CONCURRENCY = 64;

function getPort(base = 3000): number {
  return base + Math.floor(Math.random() * 1000);
}

function memUsageMB(): number {
  const usage = process.memoryUsage.rss();
  return Math.round((usage / 1024 / 1024) * 100) / 100;
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

async function runHttpBench(
  label: string,
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string | (() => string);
    iterations?: number;
    concurrency?: number;
  } = {},
) {
  const {
    method = "GET",
    headers = {},
    body,
    iterations = REQ_PER_TEST,
    concurrency = CONCURRENCY,
  } = options;

  const latencies: number[] = [];
  let completed = 0;

  const memBefore = memUsageMB();
  const start = performance.now();

  async function worker() {
    while (completed < iterations) {
      const idx = completed++;
      if (idx >= iterations) break;

      const reqBody = typeof body === "function" ? body() : body;
      const reqStart = performance.now();

      try {
        const res = await fetch(url, {
          method,
          headers: { ...headers, "connection": "keep-alive" },
          body: reqBody,
        });
        await res.arrayBuffer();
      } catch (e) {
        // count as zero latency on error
      }

      latencies.push(performance.now() - reqStart);
    }
  }

  const workers: Promise<void>[] = [];
  for (let i = 0; i < concurrency; i++) {
    workers.push(worker());
  }
  await Promise.all(workers);

  const elapsed = performance.now() - start;
  const memAfter = memUsageMB();
  const rps = Math.round((iterations / elapsed) * 1000);
  const sorted = latencies.slice(0, iterations).sort((a, b) => a - b);

  console.log(`  ${label.padEnd(32)} ${rps.toLocaleString().padStart(9)} req/s  p50=${percentile(sorted, 50).toFixed(2)}ms  p95=${percentile(sorted, 95).toFixed(2)}ms  p99=${percentile(sorted, 99).toFixed(2)}ms  mem=${memAfter}MB (+${(memAfter - memBefore).toFixed(2)}MB)`);

  return { label, rps, p50: percentile(sorted, 50), p95: percentile(sorted, 95), p99: percentile(sorted, 99), memBefore, memAfter };
}

// --- Framework helpers ---

function createBklar() {
  return Bklar({ logger: false });
}

function createHono() {
  return new Hono();
}

function createElysia() {
  return new Elysia();
}

async function startServer(framework: string, app: any, port: number): Promise<Server> {
  if (framework === "bklar") {
    return app.listen(port);
  } else if (framework === "hono") {
    return Bun.serve({ port, fetch: app.fetch, reusePort: false });
  } else if (framework === "elysia") {
    return app.listen(port);
  }
  throw new Error(`Unknown framework: ${framework}`);
}

async function stopServer(srv: Server) {
  srv.stop(true);
  await Bun.sleep(100);
}

// --- Benchmarks ---

async function benchPlainText() {
  console.log("\n📊 Plain Text");
  console.log("-".repeat(55));

  for (const fw of ["bklar", "hono", "elysia"] as const) {
    const port = getPort();
    let app: any;
    if (fw === "bklar") {
      app = createBklar();
      app.get("/", () => "hello");
    } else if (fw === "hono") {
      app = createHono();
      app.get("/", (c: any) => c.text("hello"));
    } else {
      app = createElysia();
      app.get("/", () => "hello");
    }
    const srv = await startServer(fw, app, port);
    await runHttpBench(`${fw} plain-text`, `http://localhost:${port}/`);
    await stopServer(srv);
  }
}

async function benchJson() {
  console.log("\n📊 JSON Response");
  console.log("-".repeat(55));

  for (const fw of ["bklar", "hono", "elysia"] as const) {
    const port = getPort();
    let app: any;
    if (fw === "bklar") {
      app = createBklar();
      app.get("/json", () => ({ id: 1, name: "test", active: true }));
    } else if (fw === "hono") {
      app = createHono();
      app.get("/json", (c: any) => c.json({ id: 1, name: "test", active: true }));
    } else {
      app = createElysia();
      app.get("/json", () => ({ id: 1, name: "test", active: true }));
    }
    const srv = await startServer(fw, app, port);
    await runHttpBench(`${fw} json`, `http://localhost:${port}/json`);
    await stopServer(srv);
  }
}

async function benchRouteParams() {
  console.log("\n📊 Route Params (2 dynamic segments)");
  console.log("-".repeat(55));

  for (const fw of ["bklar", "hono", "elysia"] as const) {
    const port = getPort();
    let app: any;
    if (fw === "bklar") {
      app = createBklar();
      app.get("/users/:id/posts/:postId", (ctx) => ({ id: ctx.params.id, post: ctx.params.postId }));
    } else if (fw === "hono") {
      app = createHono();
      app.get("/users/:id/posts/:postId", (c: any) => c.json({ id: c.req.param("id"), post: c.req.param("postId") }));
    } else {
      app = createElysia();
      app.get("/users/:id/posts/:postId", ({ params }) => ({ id: params.id, post: params.postId }));
    }
    const srv = await startServer(fw, app, port);
    await runHttpBench(`${fw} params`, `http://localhost:${port}/users/42/posts/99`);
    await stopServer(srv);
  }
}

async function benchMiddleware() {
  console.log("\n📊 Middleware Chain (3 layers)");
  console.log("-".repeat(55));

  for (const fw of ["bklar", "hono", "elysia"] as const) {
    const port = getPort();
    let app: any;
    if (fw === "bklar") {
      app = createBklar();
      app.use(async (ctx, next) => next());
      app.use(async (ctx, next) => next());
      app.use(async (ctx, next) => next());
      app.get("/mw", () => "ok");
    } else if (fw === "hono") {
      app = createHono();
      app.use(async (c, next) => { await next(); });
      app.use(async (c, next) => { await next(); });
      app.use(async (c, next) => { await next(); });
      app.get("/mw", (c: any) => c.text("ok"));
    } else {
      app = createElysia();
      app.derive(async () => {});
      app.derive(async () => {});
      app.derive(async () => {});
      app.get("/mw", () => "ok");
    }
    const srv = await startServer(fw, app, port);
    await runHttpBench(`${fw} middleware`, `http://localhost:${port}/mw`);
    await stopServer(srv);
  }
}

async function benchValidation() {
  console.log("\n📊 Validation (JSON body, zod)");
  console.log("-".repeat(55));

  const body = JSON.stringify({ name: "alice", age: 30 });

  for (const fw of ["bklar", "elysia"] as const) {
    const port = getPort();
    let app: any;
    if (fw === "bklar") {
      app = createBklar();
      const schema = z.object({ name: z.string(), age: z.number() });
      app.post("/validate", (ctx) => ctx.body, { schemas: { body: schema } });
    } else {
      app = createElysia();
      app.post("/validate", ({ body }) => body, {
        body: t.Object({ name: t.String(), age: t.Number() }),
      });
    }
    const srv = await startServer(fw, app, port);
    await runHttpBench(`${fw} validation`, `http://localhost:${port}/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    await stopServer(srv);
  }
}

async function benchStreaming() {
  console.log("\n📊 Streaming (ReadableStream, 1KB chunks)");
  console.log("-".repeat(55));

  for (const fw of ["bklar", "hono"] as const) {
    const port = getPort();
    let app: any;
    if (fw === "bklar") {
      app = createBklar();
      app.get("/stream", () => {
        let count = 0;
        return new ReadableStream({
          pull(ctrl) {
            if (count++ < 10) {
              ctrl.enqueue(new TextEncoder().encode("x".repeat(1024)));
            } else {
              ctrl.close();
            }
          },
        });
      });
    } else {
      app = createHono();
      app.get("/stream", (c: any) => {
        let count = 0;
        const stream = new ReadableStream({
          pull(ctrl) {
            if (count++ < 10) {
              ctrl.enqueue(new TextEncoder().encode("x".repeat(1024)));
            } else {
              ctrl.close();
            }
          },
        });
        return new Response(stream);
      });
    }
    const srv = await startServer(fw, app, port);
    await runHttpBench(`${fw} streaming`, `http://localhost:${port}/stream`, { iterations: 10_000, concurrency: 32 });
    await stopServer(srv);
  }
}

async function benchWebSocket() {
  console.log("\n📊 WebSocket Echo");
  console.log("-".repeat(55));

  const port = getPort();
  const app = createBklar();
  app.ws("/ws", {
    open(ws) { ws.send("ready"); },
    message(ws, msg) { ws.send(`echo: ${msg}`); },
  });
  const srv = await startServer("bklar", app, port);

  const ITERATIONS = 5_000;
  const latencies: number[] = [];
  const memBefore = memUsageMB();
  const start = performance.now();

  let completed = 0;

  async function wsWorker() {
    while (completed < ITERATIONS) {
      const idx = completed;
      completed++;

      const ws = new WebSocket(`ws://localhost:${port}/ws`);
      await new Promise<void>((resolve) => {
        ws.onopen = () => {
          const reqStart = performance.now();
          ws.onmessage = () => {
            latencies.push(performance.now() - reqStart);
            ws.close();
            resolve();
          };
          ws.send("ping");
        };
        ws.onerror = () => resolve();
      });

      if (idx >= ITERATIONS - 1) break;
    }
  }

  const workers: Promise<void>[] = [];
  for (let i = 0; i < 32; i++) {
    workers.push(wsWorker());
  }
  await Promise.all(workers);

  const elapsed = performance.now() - start;
  const memAfter = memUsageMB();
  const rps = Math.round((ITERATIONS / elapsed) * 1000);
  const sorted = latencies.sort((a, b) => a - b);

  console.log(`  ${"bklar websocket".padEnd(32)} ${rps.toLocaleString().padStart(9)} req/s  p50=${percentile(sorted, 50).toFixed(2)}ms  p95=${percentile(sorted, 95).toFixed(2)}ms  p99=${percentile(sorted, 99).toFixed(2)}ms  mem=${memAfter}MB (+${(memAfter - memBefore).toFixed(2)}MB)`);

  await stopServer(srv);
}

async function benchConcurrency() {
  console.log("\n📊 Concurrent Connection Scaling");
  console.log("-".repeat(55));

  const port = getPort();
  const app = createBklar();
  app.get("/concurrent", async () => {
    await Bun.sleep(5);
    return { ok: true };
  });
  const srv = await startServer("bklar", app, port);

  const concurrencyLevels = [8, 32, 128, 512];
  const iterations = 5_000;

  for (const concurrency of concurrencyLevels) {
    const latencies: number[] = [];
    let completed = 0;
    const start = performance.now();

    async function worker() {
      while (completed < iterations) {
        completed++;
        const reqStart = performance.now();
        try {
          const res = await fetch(`http://localhost:${port}/concurrent`, {
            headers: { connection: "keep-alive" },
          });
          await res.arrayBuffer();
        } catch {}
        latencies.push(performance.now() - reqStart);
      }
    }

    const workers: Promise<void>[] = [];
    for (let i = 0; i < concurrency; i++) {
      workers.push(worker());
    }
    await Promise.all(workers);

    const elapsed = performance.now() - start;
    const rps = Math.round((iterations / elapsed) * 1000);
    const sorted = latencies.sort((a, b) => a - b);

    console.log(`  concurrency=${String(concurrency).padEnd(4)} ${rps.toLocaleString().padStart(9)} req/s  p50=${percentile(sorted, 50).toFixed(2)}ms  p95=${percentile(sorted, 95).toFixed(2)}ms  p99=${percentile(sorted, 99).toFixed(2)}ms`);
  }

  await stopServer(srv);
}

// --- Main ---

async function runHttpBenchmarks() {
  console.log("\n🚀 Bklar HTTP Benchmark Suite (real server, keep-alive)");
  console.log(`   ${REQ_PER_TEST.toLocaleString()} requests per test, ${CONCURRENCY} concurrent connections`);
  console.log("=".repeat(55));
  console.log(`   Baseline memory: ${memUsageMB()} MB RSS`);
  console.log("=".repeat(55));

  await benchPlainText();
  await benchJson();
  await benchRouteParams();
  await benchMiddleware();
  await benchValidation();
  await benchStreaming();
  await benchWebSocket();
  await benchConcurrency();

  console.log("=".repeat(55));
  console.log("✅ HTTP benchmarks complete\n");
}

runHttpBenchmarks().catch(console.error);
