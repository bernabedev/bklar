# @bklarjs/cron ⏰

[![NPM Version](https://img.shields.io/npm/v/@bklarjs/cron.svg)](https://www.npmjs.com/package/@bklarjs/cron)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A minimal, robust, and type-safe cron job scheduler for the **[bklar](https://www.npmjs.com/package/bklar)** framework.

This plugin allows you to define scheduled tasks directly within your application middleware, automatically manages their lifecycle, and exposes runtime controls (start/stop) to your route handlers via the application context.

---

## ✨ Features

- 📅 **Standard Cron Syntax:** Supports standard 5-field and 6-field (seconds) cron patterns.
- 🎛️ **Context Integration:** Jobs are registered to `ctx.state.cron`, allowing you to control them programmatically from your API.
- 🛡️ **Overlap Protection:** Built-in support to skip scheduled runs if the previous execution hasn't finished.
- ⚡ **Lightweight:** Designed for in-memory, single-instance workloads without heavy external dependencies.
- 🧩 **TypeScript Ready:** Full type support for configuration and job controls.

## 📦 Installation

This package is designed to work with `bklar`.

```bash
bun add bklar @bklarjs/cron
```

## 🚀 Quick Start

1. **Register the middleware** with your job configuration.
2. **Access the job** in your routes via `ctx.state.cron`.

```typescript
import { Bklar } from "bklar";
import { cron } from "@bklarjs/cron";

const app = Bklar();

// 1. Register a background task
app.use(
  cron({
    name: "heartbeat",
    pattern: "*/5 * * * * *", // Run every 5 seconds
    run: () => {
      console.log("💓 App is alive at", new Date().toISOString());
    },
  })
);

// 2. Control the job via an endpoint
app.get("/status", (ctx) => {
  // Access the job by its name
  const job = ctx.state.cron.heartbeat;

  return ctx.json({
    isRunning: job.isRunning(),
    nextRun: job.nextRun(),
  });
});

app.listen(3000);
```

## ⚙️ Configuration Options

The `cron(config)` factory accepts the following options:

| Option          | Type                | Default         | Description                                                                                |
| :-------------- | :------------------ | :-------------- | :----------------------------------------------------------------------------------------- |
| **`name`**      | `string`            | **Required**    | A unique identifier for the job. Used to access the job in `ctx.state.cron`.               |
| **`pattern`**   | `string`            | **Required**    | The cron expression (e.g., `* * * * *` or `*/5 * * * * *`).                                |
| **`run`**       | `() => void`        | **Required**    | The function to execute. Can be asynchronous.                                              |
| **`timezone`**  | `string`            | `Local`         | IANA timezone string (e.g., `America/New_York` or `Europe/London`).                        |
| **`autoStart`** | `boolean`           | `true`          | Whether the job should start immediately upon registration.                                |
| **`overlap`**   | `"allow" \| "skip"` | `"allow"`       | Determines behavior if a scheduled run triggers while the previous run is still executing. |
| **`onError`**   | `(err) => void`     | `console.error` | Callback for handling errors thrown inside the `run` function.                             |

## 🕹️ Controlling Jobs

Every registered job is exposed in the `ctx.state.cron` object. The job interface provides the following methods:

```typescript
interface CronJobControl {
  start(): void; // Resumes/Starts the schedule
  stop(): void; // Pauses/Stops the schedule
  isRunning(): boolean; // Returns true if the schedule is active
  nextRun(): Date | null; // Returns the next scheduled execution date
}
```

### Example: Stopping a Job via API

```typescript
app.post("/jobs/:name/stop", (ctx) => {
  const { name } = ctx.params;
  const job = ctx.state.cron[name];

  if (!job) {
    return ctx.json({ error: "Job not found" }, 404);
  }

  job.stop();
  return ctx.json({ message: `Job '${name}' has been stopped.` });
});
```

## 🛡️ Handling Overlaps

If you have a long-running task (e.g., database backup, heavy report generation) and you want to ensure it never runs concurrently with itself, set `overlap` to `"skip"`.

```typescript
app.use(
  cron({
    name: "nightly-backup",
    pattern: "0 3 * * *", // Every day at 3:00 AM
    overlap: "skip", // If the previous backup is still running, skip this one
    run: async () => {
      console.log("Starting backup...");
      await performHeavyBackup();
      console.log("Backup finished.");
    },
  })
);
```

## 🧩 Patterns Helper

For convenience, we provide a `Patterns` object with common cron expressions to avoid looking up syntax.

```typescript
import { cron, Patterns } from "@bklarjs/cron";

app.use(
  cron({
    name: "cleanup",
    pattern: Patterns.EVERY_DAY_AT_MIDNIGHT,
    run: () => console.log("Cleaning up temp files..."),
  })
);
```

**Available Patterns:**

- `EVERY_SECOND`: `* * * * * *`
- `EVERY_MINUTE`: `* * * * *`
- `EVERY_HOUR`: `0 * * * *`
- `EVERY_DAY_AT_MIDNIGHT`: `0 0 * * *`
- `EVERY_MONDAY`: `0 0 * * 1`
- `EVERY_MONTH`: `0 0 1 * *`

## ⚠️ Production Notes

### In-Memory Behavior

`@bklarjs/cron` runs **in-memory**.

1. **Persistence:** If you restart your server, the job history and "running" state resets (though `autoStart` defaults to true).
2. **Clustering:** If you run multiple instances of your bklar application (e.g., using PM2 clusters or Kubernetes replicas), **each instance will run its own copy of the cron job**.

   _For distributed systems where a job must run exactly once across a cluster, consider using an external job queue (like Redis/BullMQ) instead of this middleware._

### Error Handling

By default, errors thrown inside the `run` function are caught and logged to `console.error` to prevent crashing the main application thread. You can customize this behavior:

```typescript
app.use(
  cron({
    name: "risky-job",
    pattern: "* * * * *",
    run: () => {
      throw new Error("Something went wrong");
    },
    onError: (err) => {
      // Send to Sentry, Datadog, etc.
      myLogger.error("Cron job failed", err);
    },
  })
);
```

## 🤝 Contributing

Contributions are welcome! Please open an [issue](https://github.com/bernabedev/bklar/issues) or submit a Pull Request to the main `bklar` repository.

## 📄 License

This project is licensed under the **MIT License**.
