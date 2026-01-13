import type { LogEntry, LogLevel } from "./types";

const COLORS = {
  reset: "\x1b[0m",
  gray: "\x1b[90m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  magenta: "\x1b[35m",
  white: "\x1b[37m",
};

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: COLORS.gray,
  info: COLORS.green,
  warn: COLORS.yellow,
  error: COLORS.red,
  fatal: COLORS.magenta,
};

export function formatJson(entry: LogEntry): string {
  return JSON.stringify(entry);
}

export function formatPretty(entry: LogEntry): string {
  const { level, time, msg, reqId, req, res, ...rest } = entry;

  const date = new Date(time).toISOString().split("T")[1].split("Z")[0];
  const color = LEVEL_COLORS[level] || COLORS.white;
  const levelStr = level.toUpperCase().padEnd(5);

  let line = `${COLORS.gray}[${date}]${COLORS.reset} ${color}${levelStr}${COLORS.reset}`;

  if (reqId) {
    line += ` ${COLORS.gray}(${reqId.slice(0, 8)})${COLORS.reset}`;
  }

  // Special handling for HTTP Access Logs
  if (req && res) {
    const method = req.method || "-";
    const url = req.url || "-";
    const status = res.status || 0;
    const duration = res.durationMs || 0;

    let statusColor = COLORS.green;
    if (status >= 500) statusColor = COLORS.red;
    else if (status >= 400) statusColor = COLORS.yellow;
    else if (status >= 300) statusColor = COLORS.cyan;

    line += ` ${method} ${url} ${statusColor}${status}${COLORS.reset} ${duration}ms`;
  }

  if (msg) {
    line += ` ${msg}`;
  }

  // Print extra props if any
  if (Object.keys(rest).length > 0) {
    const extra = JSON.stringify(rest);
    // Truncate if too long in pretty mode
    if (extra.length > 200) {
      line += ` ${COLORS.gray}${extra.substring(0, 200)}...${COLORS.reset}`;
    } else {
      line += ` ${COLORS.gray}${extra}${COLORS.reset}`;
    }
  }

  return line;
}
