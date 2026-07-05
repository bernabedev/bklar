const [framework, port] = process.argv.slice(2);
const ITER = 10_000;
const CONC = 32;

function memUsage() {
  if (typeof Bun !== "undefined") Bun.gc(true);
  const u = process.memoryUsage();
  return { rss: Math.round((u.rss/1024/1024)*100)/100, heapUsed: Math.round((u.heapUsed/1024/1024)*100)/100 };
}

async function main() {
  let app: any;
  let srv: any;
  const portNum = parseInt(port, 10);

  if (framework === "bklar") {
    const { Bklar } = await import("bklar");
    app = Bklar({ logger: false, requestId: { fast: true } });
    app.get("/", () => "hello");
    srv = app.listen(portNum);
  } else if (framework === "hono") {
    const { Hono } = await import("hono");
    app = new Hono();
    app.get("/", (c: any) => c.text("hello"));
    srv = Bun.serve({ port: portNum, fetch: app.fetch });
  } else {
    const { Elysia } = await import("elysia");
    app = new Elysia();
    app.get("/", () => "hello");
    srv = app.listen(portNum);
  }

  await Bun.sleep(50);

  Bun.gc(true);
  const memBefore = memUsage();

  let completed = 0;
  const start = performance.now();

  async function worker() {
    while (completed < ITER) {
      completed++;
      try {
        const res = await fetch(`http://localhost:${portNum}/`, { headers: { connection: "keep-alive" } });
        await res.arrayBuffer();
      } catch {}
    }
  }

  const workers = [];
  for (let i = 0; i < CONC; i++) workers.push(worker());
  await Promise.all(workers);

  const elapsed = performance.now() - start;

  Bun.gc(true);
  const memAfter = memUsage();

  const rps = Math.round((ITER / elapsed) * 1000);
  const memRss = memAfter.rss - memBefore.rss;
  const memHeap = memAfter.heapUsed - memBefore.heapUsed;

  srv.stop(true);

  process.stdout.write(JSON.stringify({ type: "result", rps, memRss, memHeap, framework, label: "plain-text" }) + "\n");
}

main().catch(e => { process.stderr.write(String(e) + "\n"); process.exit(1); });
