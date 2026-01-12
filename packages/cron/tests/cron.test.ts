import { describe, expect, it, afterEach } from "bun:test";
import { Bklar } from "bklar";
import { cron } from "../src/index";

describe("Cron Middleware", () => {
  let app: ReturnType<typeof Bklar>;

  afterEach(() => {
    // Cleanup any potentially running jobs
    // In a real app, you'd likely want a way to stop all jobs on shutdown
  });

  it("should register a job in ctx.state.cron", async () => {
    app = Bklar({ logger: false });

    app.use(
      cron({
        name: "testJob",
        pattern: "* * * * *", // Every minute
        autoStart: false, // Don't actually run it
        run: () => {},
      })
    );

    app.get("/", (ctx) => {
      const job = ctx.state.cron?.testJob;
      return ctx.json({ exists: !!job });
    });

    const res = await app.request("/");
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.exists).toBe(true);
  });

  it("should expose control methods", async () => {
    app = Bklar({ logger: false });

    app.use(
      cron({
        name: "controlTest",
        pattern: "* * * * *",
        autoStart: false,
        run: () => {},
      })
    );

    app.get("/control", (ctx) => {
      const job = ctx.state.cron.controlTest;

      const initiallyRunning = job.isRunning();
      job.start();
      const afterStart = job.isRunning();
      job.stop();
      const afterStop = job.isRunning();

      return ctx.json({ initiallyRunning, afterStart, afterStop });
    });

    const res = await app.request("/control");
    const body = await res.json();

    expect(body.initiallyRunning).toBe(false);
    expect(body.afterStart).toBe(true);
    expect(body.afterStop).toBe(false);
  });

  it("should execute the run function", async () => {
    // This test is slightly tricky with async timing,
    // we use a flag to verify execution.
    let executed = false;

    app = Bklar({ logger: false });

    // Pattern to run every second
    app.use(
      cron({
        name: "execTest",
        pattern: "* * * * * *",
        run: () => {
          executed = true;
        },
      })
    );

    // Start server logic to init middleware
    await app.request("/");

    // Wait for > 1 second
    await new Promise((r) => setTimeout(r, 1100));

    // Cleanup
    // Since we can't easily access the job instance outside the request flow in this test setup,
    // we rely on the process exit or GC in unit tests, or we could expose a global registry.

    expect(executed).toBe(true);
  });
});
