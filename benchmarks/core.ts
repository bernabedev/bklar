import { Bklar } from "bklar";
import { z } from "zod/v4";

const ITERATIONS = 100_000;
const WARMUP = 10_000;

function bench(name: string, fn: () => void | Promise<void>, iterations = ITERATIONS) {
  // Warmup
  for (let i = 0; i < WARMUP; i++) fn();

  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  const elapsed = performance.now() - start;
  const opsPerSec = Math.round((iterations / elapsed) * 1000);
  const avgMs = (elapsed / iterations).toFixed(4);

  console.log(`  ${name.padEnd(30)} ${opsPerSec.toLocaleString().padStart(10)} req/s  (${avgMs} ms/req)`);
  return { name, opsPerSec, avgMs };
}

async function runBenchmarks() {
  console.log("\n🚀 Bklar Benchmark Suite");
  console.log(`   ${ITERATIONS.toLocaleString()} iterations, ${WARMUP.toLocaleString()} warmup`);
  console.log("=".repeat(60));

  // --- Plain Text ---
  const app1 = Bklar({ logger: false });
  app1.get("/", () => "hello");
  await bench("Plain Text", () => app1.request("/"));

  // --- JSON ---
  const app2 = Bklar({ logger: false });
  app2.get("/json", () => ({ id: 1, name: "test", active: true }));
  await bench("JSON Response", () => app2.request("/json"));

  // --- Route Params ---
  const app3 = Bklar({ logger: false });
  app3.get("/users/:id/posts/:postId", (ctx) => ({ id: ctx.params.id, post: ctx.params.postId }));
  await bench("Route Params (2)", () => app3.request("/users/42/posts/99"));

  // --- Middleware Chain (3 layers) ---
  const app4 = Bklar({ logger: false });
  app4.use(async (ctx, next) => next());
  app4.use(async (ctx, next) => next());
  app4.use(async (ctx, next) => next());
  app4.get("/mw", () => "ok");
  await bench("Middleware Chain (3)", () => app4.request("/mw"));

  // --- Validation ---
  const app5 = Bklar({ logger: false });
  const schema = z.object({ name: z.string(), age: z.number() });
  app5.post("/validate", (ctx) => ctx.body, { schemas: { body: schema } });
  await bench("Validation (JSON body)", () =>
    app5.request("/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "alice", age: 30 }),
    })
  );

  // --- 404 ---
  const app6 = Bklar({ logger: false });
  app6.get("/exists", () => "ok");
  await bench("404 Not Found", () => app6.request("/missing"));

  // --- Request ID + Server Timing ---
  const app7 = Bklar({ logger: false });
  app7.get("/traced", (ctx) => {
    ctx.serverTiming("db", 1);
    return ctx.text("traced");
  });
  await bench("With Request ID + Timing", () => app7.request("/traced"));

  console.log("=".repeat(60));
  console.log("✅ Benchmarks complete\n");
}

runBenchmarks().catch(console.error);
