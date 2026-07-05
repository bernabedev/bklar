interface MemSnapshot {
  rss: number;
  heapUsed: number;
}

function memUsage(): MemSnapshot {
  if (typeof Bun !== "undefined") Bun.gc(true);
  const usage = process.memoryUsage();
  return {
    rss: Math.round((usage.rss / 1024 / 1024) * 100) / 100,
    heapUsed: Math.round((usage.heapUsed / 1024 / 1024) * 100) / 100,
  };
}

interface BenchResult {
  framework: string;
  rps: number;
  memRss: number;
  memHeap: number;
}

async function runBenchInProcess(framework: string, port: number): Promise<BenchResult> {
  const proc = Bun.spawn(["bun", "run", import.meta.dirname + "/memory-worker.ts", framework, String(port)], {
    stdout: "pipe",
    stderr: "pipe",
    cwd: new URL("..", import.meta.url).pathname,
    env: { ...process.env },
  });

  const exitCode = await proc.exited;
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();

  if (exitCode !== 0) {
    console.log(`    ERROR (exit ${exitCode}): ${stderr.slice(0, 200)}`);
    return { framework, rps: 0, memRss: 0, memHeap: 0 };
  }

  let rps = 0;
  let memRss = 0;
  let memHeap = 0;

  for (const line of stdout.split("\n")) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line.trim());
      if (parsed.type === "result") {
        rps = parsed.rps;
        memRss = parsed.memRss;
        memHeap = parsed.memHeap;
      }
    } catch {}
  }

  return { framework, rps, memRss, memHeap };
}

async function runSeparateProcessBenchmarks() {
  console.log("\n🧹 Separate-Process Memory Benchmarks");
  console.log("   Each framework runs in its own `bun run` subprocess");
  console.log("=".repeat(60));

  const theBaseline = memUsage();
  console.log(`   Parent baseline: rss=${theBaseline.rss}MB heap=${theBaseline.heapUsed}MB\n`);

  const frameworks = ["bklar", "hono", "elysia"] as const;
  const results: BenchResult[] = [];

  for (const fw of frameworks) {
    const port = 3000 + Math.floor(Math.random() * 1000);
    console.log(`  ${fw} on port ${port}...`);
    const result = await runBenchInProcess(fw, port);
    results.push(result);
    console.log(`    → ${result.rps.toLocaleString()} req/s, rss +${result.memRss.toFixed(2)}MB, heap +${result.memHeap.toFixed(2)}MB`);
    await Bun.sleep(500);
  }

  console.log("\n📊 Summary:");
  console.log("-".repeat(60));

  const headers = ["Framework", "req/s", "RSS delta", "Heap delta", "req/s/ΔRSS"];
  const rows = results.map(r => [
    r.framework,
    r.rps.toLocaleString(),
    `+${r.memRss.toFixed(2)}MB`,
    `+${r.memHeap.toFixed(2)}MB`,
    r.memRss > 0 ? Math.round(r.rps / r.memRss).toLocaleString() : "-",
  ]);

  const colWidths = [12, 12, 14, 14, 16];
  const pad = (s: string, w: number) => s.padStart(w);
  console.log(headers.map((h, i) => pad(h, colWidths[i])).join(""));
  for (const row of rows) {
    console.log(row.map((c, i) => pad(c, colWidths[i])).join(""));
  }

  console.log("\n   Separate-process isolation avoids cross-framework memory contamination.");
  console.log("   req/s/ΔRSS = throughput per MB of RSS growth (higher is more efficient).");
}

if (process.argv.includes("--separate") || process.argv.includes("--separate-processes")) {
  runSeparateProcessBenchmarks().catch(console.error);
} else {
  console.log("Run with --separate-processes to enable separate-process memory benchmarking.");
}
