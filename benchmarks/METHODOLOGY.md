# Benchmark Methodology

## Core vs HTTP Benchmarks

### Core Benchmark (`benchmarks/core.ts`)

**Purpose**: Internal regression tracking for the framework's in-process pipeline.

**What it measures**: Raw throughput of router + middleware + handler chain with zero network overhead. It calls `app.request()` directly — no HTTP server, no TCP sockets, no serialization.

**When to run**: After changes to the router, context, middleware composition, or validation code.

**What it does NOT measure**:
- Network throughput (TCP overhead, connection handling)
- Keep-alive behavior
- Concurrent request handling
- Memory allocation under load
- Latency distribution (p50/p95/p99)
- Streaming or WebSocket throughput

**Configuration**:
- 100,000 iterations per test
- 10,000 warmup iterations
- Timing via `performance.now()`
- Bklar only (no cross-framework comparison)
- Run: `bun run bench:core`

### HTTP Benchmark (`benchmarks/http.ts`)

**Purpose**: Realistic network-level throughput against a live server.

**What it measures**: Actual HTTP/1.1 throughput with a concurrent fetch client in the same process. Cross-framework comparison against Hono and Elysia.

**What it does NOT replace**: External load tools like `oha`, `wrk`, or `bombardier`.

**Configuration**:
- 50,000 requests per test
- 64 concurrent connections (configurable per-test)
- Keep-alive enabled with explicit `connection: keep-alive` header
- Timing via `performance.now()` (per-request latency tracking)
- Run: `bun run bench:http`

---

## Concurrency Level

The default concurrency of 64 concurrent workers was chosen to saturate a single Bun event loop without excessive scheduling overhead. Each worker runs an async loop that issues `fetch()` calls and awaits responses. Since Bun is single-threaded for JS execution, these workers interleave at `await` boundaries rather than running truly in parallel.

For the concurrency scaling benchmark, levels [8, 32, 128, 512] are tested against a route that `await Bun.sleep(5)` to simulate I/O-bound work.

---

## Keep-Alive Behavior

All HTTP benchmarks explicitly send `connection: keep-alive`. Bun's `fetch` API manages HTTP/1.1 connection pooling automatically — the benchmark does not configure `maxSockets` or connection pool size. This means connection reuse behavior depends on Bun's internal defaults.

---

## Machine / Runtime

- **Runtime**: Bun (version varies, check with `bun --version`)
- **OS**: macOS (darwin-x64) or Linux x64
- **CPU**: Varies by machine
- **Memory**: Varies by machine

Benchmarks are intended for relative comparisons, not absolute throughput claims. Results will vary significantly between machines.

---

## Memory Measurement

- Both `rss` (Resident Set Size) and `heapUsed` (JavaScript heap used) are tracked.
- GC is forced via `Bun.gc(true)` before each measurement snapshot.
- Delta is computed as `after - before` for each benchmark run.
- GC is also forced between framework tests (in `stopServer()`) to avoid cross-contamination.

**Known limitation**: Same-process client and server share memory, so per-framework deltas reflect combined allocation. For clean per-framework memory numbers, use separate-process mode.

## Separate-Process Memory Benchmark (`memory.ts`)

The `memory.ts` suite runs each framework in its own `Bun.spawn` child process, eliminating memory contamination between frameworks.

**Run**: `bun run benchmarks/memory.ts --separate-processes`

**What it reports**:
- Throughput (req/s) per framework in isolation
- RSS delta (MB) — the framework's memory footprint growth during the benchmark
- Heap delta (MB) — JS heap growth
- Efficiency ratio (req/s per MB of RSS growth) — higher is better

**Usage**: This is the most reliable way to compare memory efficiency between frameworks.

---

## Response Consumption

Every fetch response body is fully consumed with `await res.arrayBuffer()` before the latency measurement is recorded. This ensures the benchmark accounts for full response delivery, not just headers.

---

## Framework Setup Parity

All three frameworks (Bklar, Hono, Elysia) are set up for Bun-native server configurations:

| Framework | Server Start | Notes |
|---|---|---|
| Bklar | `app.listen(port)` | Wraps `Bun.serve()` internally |
| Hono | `Bun.serve({ port, fetch: app.fetch })` | Hono's recommended Bun-native approach |
| Elysia | `app.listen(port)` | Wraps `Bun.serve()` internally |

No Node.js adapters or artificial wrappers are used. The Hono benchmark does not use `@hono/node-server` — it uses `Bun.serve()` directly, which is the idiomatic Bun-native approach.

**Known asymmetry**: Elysia's middleware benchmark uses `.derive()` rather than `.use()` since Elysia's middleware model is fundamentally different. Bklar and Hono use `.use()` with async middleware.

---

## Limitations

1. **Single-process client and server**: The fetch client runs in the same Bun event loop as the server. This causes mutual interference between the load generator and server. Use `oha`, `wrk`, or `bombardier` for production throughput numbers.

2. **No statistical rigor**: Benchmarks run once per scenario. No standard deviation, no confidence intervals, no multiple trials. Results are approximate.

3. **No CI integration**: Benchmarks are not run automatically on PRs or commits.

4. **Configurable keep-alive not tuned**: Connection pooling relies on Bun's default behavior.

5. **Memory measurement is coarse**: RSS + heapUsed with forced GC does not isolate per-request allocation patterns.

6. **Async handler penalty**: Benchmarks use async middleware (`async (ctx, next) => next()`). Bklar's async handler dispatch is ~26x slower than sync. However, real-world middleware (auth, logging) is inherently async, so this is representative.

---

## Available Profiling (`benchmarks/perf-profile.ts`)

The `perf-profile.ts` suite provides isolated microbenchmarks for each internal pipeline step:

- Context creation (UUID generation, URL parsing, class instantiation)
- Route matching (static, param, wildcard, miss paths)
- Middleware composition (construction overhead, dispatch at various depths)
- Response normalization and creation
- Header merging (empty vs populated)
- Empty guard fast paths
- Lazy body parsing
- Compose caching analysis

Run: `bun run benchmarks/perf-profile.ts`

---

## Running with External Tools

For production throughput numbers, use an external HTTP load generator on a separate machine:

```bash
# Start the app
bun run app.ts

# Load test (from another machine)
oha -n 100000 -c 256 http://target-host:3000/
wrk -t8 -c256 -d30s http://target-host:3000/
bombardier -c 256 -n 100000 http://target-host:3000/
```
