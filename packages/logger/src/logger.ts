import {
  type LogEntry,
  type LoggerOptions,
  type LogLevel,
  LEVEL_PRIORITY,
} from "./types";
import { formatJson, formatPretty } from "./formatters";

const DEFAULT_REDACT = [
  "password",
  "token",
  "secret",
  "authorization",
  "cookie",
  "key",
];

export class Logger {
  private level: number;
  private redactKeys: Set<string>;
  private format: "json" | "pretty";
  private base: Record<string, any>;
  private stream: (msg: any) => void;

  constructor(options: LoggerOptions = {}) {
    const envLevel = process.env.LOG_LEVEL as LogLevel;
    const defaultLevel =
      process.env.NODE_ENV === "production" ? "info" : "debug";

    this.level = LEVEL_PRIORITY[options.level || envLevel || defaultLevel];
    this.redactKeys = new Set(options.redact || DEFAULT_REDACT);
    this.format =
      options.format ||
      (process.env.NODE_ENV === "production" ? "json" : "pretty");
    this.base = options.base || {};
    this.stream = options.stream || console.log;
  }

  /**
   * Create a child logger with additional context
   */
  child(bindings: Record<string, any>): Logger {
    const child = new Logger({
      level: Object.keys(LEVEL_PRIORITY).find(
        (k) => LEVEL_PRIORITY[k as LogLevel] === this.level
      ) as LogLevel,
      redact: Array.from(this.redactKeys),
      format: this.format,
      base: { ...this.base, ...bindings },
      stream: this.stream,
    });
    return child;
  }

  private write(level: LogLevel, msgOrObj: string | object, ...args: any[]) {
    if (LEVEL_PRIORITY[level] < this.level) return;

    let entry: LogEntry = {
      level,
      time: Date.now(),
      ...this.base,
    };

    if (typeof msgOrObj === "string") {
      entry.msg = msgOrObj;
      if (args.length > 0) entry.args = args;
    } else {
      // Merge object, redacting sensitive fields
      Object.assign(entry, this.redact(msgOrObj));
      if (args.length > 0 && typeof args[0] === "string") {
        entry.msg = args[0];
      }
    }

    const output =
      this.format === "json" ? formatJson(entry) : formatPretty(entry);
    this.stream(output);
  }

  private redact(obj: any): any {
    if (!obj || typeof obj !== "object") return obj;
    if (Array.isArray(obj)) return obj.map((i) => this.redact(i));

    const copy: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        if (this.redactKeys.has(key.toLowerCase())) {
          copy[key] = "[REDACTED]";
        } else if (typeof obj[key] === "object") {
          copy[key] = this.redact(obj[key]);
        } else {
          copy[key] = obj[key];
        }
      }
    }
    return copy;
  }

  debug(msg: string, ...args: any[]): void;
  debug(obj: object, msg?: string, ...args: any[]): void;
  debug(arg1: any, ...args: any[]) {
    this.write("debug", arg1, ...args);
  }

  info(msg: string, ...args: any[]): void;
  info(obj: object, msg?: string, ...args: any[]): void;
  info(arg1: any, ...args: any[]) {
    this.write("info", arg1, ...args);
  }

  warn(msg: string, ...args: any[]): void;
  warn(obj: object, msg?: string, ...args: any[]): void;
  warn(arg1: any, ...args: any[]) {
    this.write("warn", arg1, ...args);
  }

  error(msg: string, ...args: any[]): void;
  error(obj: object, msg?: string, ...args: any[]): void;
  error(arg1: any, ...args: any[]) {
    this.write("error", arg1, ...args);
  }

  fatal(msg: string, ...args: any[]): void;
  fatal(obj: object, msg?: string, ...args: any[]): void;
  fatal(arg1: any, ...args: any[]) {
    this.write("fatal", arg1, ...args);
  }
}
