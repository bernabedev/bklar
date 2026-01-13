export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

export const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

export interface LogEntry {
  level: LogLevel;
  time: number;
  msg?: string;
  [key: string]: any;
}

export interface LoggerOptions {
  /** Minimum level to log. Default: 'info' (or 'debug' if NODE_ENV!=production) */
  level?: LogLevel;

  /** Keys to redact from objects. Default: ['password', 'token', 'secret', 'authorization'] */
  redact?: string[];

  /** Use JSON format (production) or Pretty Print (development). Default: auto-detect */
  format?: "json" | "pretty";

  /** Base context to attach to every log (e.g., { service: 'api-v1' }) */
  base?: Record<string, any>;

  /** Custom output stream. Default: console.log */
  stream?: (entry: string | object) => void;
}
