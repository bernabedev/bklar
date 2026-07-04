# Bklar Benchmarks

This directory contains two benchmark suites with different purposes.

## Core Benchmarks (`core.ts`)

**Purpose:** Internal regression tracking for the framework's in-process request pipeline.

**What it measures:** Raw throughput of the router + middleware + handler chain without any network overhead. It calls `app.request()` directly — no HTTP server, no TCP sockets, no serialization.

**When to run:** After every significant change to the router, context, middleware composition, or validation code. Fast execution (seconds) makes it suitable for CI.

**What it does NOT measure:**

- Network throughput (TCP overhead, connection handling)
- Keep-alive behavior
- Concurrent request handling
- Memory allocation under load
- Latency distribution (p50/p95/p99)
- Streaming or WebSocket throughput

**Run:** `bun run benchmarks/core.ts`

---

## HTTP Benchmarks (`http.ts`)

**Purpose:** Realistic network-level throughput measurement of a live Bklar server.

**What it measures:** Actual HTTP/1.1 throughput against a running server using a Bun-based concurrent fetch client. This is closer to production behavior.

**Features:**

- Real HTTP server with keep-alive enabled
- Concurrent request load testing (configurable concurrency)
- Latency distribution: p50, p95, p99
- Memory usage reporting (RSS before/after)
- Streaming response benchmarks
- WebSocket throughput benchmarks
- Comparison baselines against Hono and Elysia with equivalent routes

**Run:** `bun run benchmarks/http.ts`

### What this is NOT

This is **not a replacement for production load testing tools** like `oha`, `wrk`, or `bombardier`. The Bun fetch client runs in the same process/event loop, which has inherent limitations. Use this for:

- Consistent relative comparisons between frameworks
- Catching regressions in real-server performance
- Comparing Bklar against Hono/Elysia under the same conditions

For absolute production throughput numbers, use an external load generator on a dedicated machine.
