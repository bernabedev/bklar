import type { Middleware } from "bklar";
import { Cron } from "croner";

export * from "./patterns";

export interface CronConfig {
  /** Unique name for the job. Used to access the job in ctx.state.cron */
  name: string;
  /** Cron pattern (e.g. "* * * * *") */
  pattern: string;
  /** The function to execute */
  run: () => void | Promise<void>;
  /** IANA Timezone (e.g. "America/New_York") */
  timezone?: string;
  /** Start the job immediately on creation? Default: true */
  autoStart?: boolean;
  /**
   * "allow": Concurrency allowed.
   * "skip": If previous run is still active, skip this run.
   * Default: "allow"
   */
  overlap?: "allow" | "skip";
  /** Custom error handler */
  onError?: (err: unknown) => void;
}

export interface CronJobControl {
  start: () => void;
  stop: () => void;
  isRunning: () => boolean;
  nextRun: () => Date | null;
}

declare module "bklar" {
  interface State {
    cron: Record<string, CronJobControl>;
  }
}

export function cron(config: CronConfig): Middleware {
  const {
    name,
    pattern,
    run,
    timezone,
    autoStart = true,
    overlap = "allow",
    onError = console.error,
  } = config;

  // We use croner for robust scheduling
  const job = new Cron(
    pattern,
    {
      timezone,
      paused: !autoStart,
      protect: overlap === "skip",
      catch: onError,
    },
    run
  );

  const control: CronJobControl = {
    start: () => job.resume(),
    stop: () => job.pause(),
    isRunning: () => job.isRunning(),
    nextRun: () => job.nextRun(),
  };

  return async (ctx, next) => {
    // Ensure the cron registry exists on state
    if (!ctx.state.cron) {
      ctx.state.cron = {};
    }

    // Register this job
    ctx.state.cron[name] = control;

    return next();
  };
}
