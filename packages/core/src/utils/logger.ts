const parseDate = (date: Date) => {
  return date.toISOString().replace("T", " ").split(".")[0];
};

const colors = {
  reset: "\x1b[0m",
  grey: "\x1b[90m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
};

export const defaultLogger = (
  req: Request,
  time: number,
  status: number,
  ip?: string
) => {
  const url = new URL(req.url);

  const path = url.pathname;

  const method = req.method;

  const statusColor =
    status >= 500
      ? colors.red
      : status >= 400
      ? colors.yellow
      : status >= 300
      ? colors.cyan
      : colors.green;

  const durationMs = time.toFixed(0);
  const methodColor = colors.cyan;
  const durationColor = time >= 1000 ? colors.red : colors.yellow;

  console.log(
    `${colors.grey}[${parseDate(new Date())}]${colors.reset} | ` +
      `${statusColor}${status}${colors.reset} | ` +
      `${methodColor}${method.padEnd(7)}${colors.reset} | ` +
      `${path.padEnd(30)} | ` +
      `${durationColor}${durationMs}ms${colors.reset} | ` +
      `${ip || "unknown-ip"}`
  );
};
