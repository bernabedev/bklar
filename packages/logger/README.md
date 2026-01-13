# @bklarjs/logger 📝

[![NPM Version](https://img.shields.io/npm/v/@bklarjs/logger.svg)](https://www.npmjs.com/package/@bklarjs/logger)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Enterprise-grade structured logging system for **[bklar](https://www.npmjs.com/package/bklar)**.

Unlike simple console loggers, this package provides a complete observability suite compatible with production standards (Datadog, CloudWatch, ELK), offering deep context injection, redaction, and log levels.

---

## ✨ Features

- 🏗️ **Structured JSON:** Standard output format for production ingestion.
- 🎨 **Pretty Print:** Beautiful, colorful output for local development.
- 🆔 **Context Awareness:** Automatically injects `ctx.logger` into every request, pre-bound with the `requestId`.
- 🕵️ **Smart Redaction:** Recursively sanitizes sensitive fields (passwords, tokens, secrets) before logging.
- 📊 **Log Levels:** Supports `debug`, `info`, `warn`, `error`, `fatal`.
- 🔗 **Request Correlation:** Generates or propagates `X-Request-Id` headers.

## 📦 Installation

This package is designed to work with `bklar`.

```bash
bun add bklar @bklarjs/logger
```

## 🚀 Usage

### 1. Setup Global Middleware

It is recommended to disable the default Bklar logger and use this middleware instead.

```typescript
import { Bklar } from "bklar";
import { logger } from "@bklarjs/logger";

const app = Bklar({ logger: false }); // Disable default logger

// Apply middleware globally
app.use(logger());

app.get("/", (ctx) => {
  // Use the context logger!
  // It automatically includes the Request ID.
  ctx.logger.info("Handling root request");

  return ctx.json({ hello: "world" });
});

app.listen(3000);
```

### 2. Standalone Usage

You can use the logger class anywhere in your application (e.g., services, db connectors).

```typescript
import { Logger } from "@bklarjs/logger";

const log = new Logger({ base: { service: "payment-service" } });

log.info("Service started");
log.error({ err: new Error("DB fail") }, "Connection failed");
```

## 🛡️ Automatic Redaction

The logger automatically removes sensitive keys from objects to prevent leaking secrets into logs.

**Default keys redacted:** `password`, `token`, `secret`, `authorization`, `cookie`, `key`.

```typescript
ctx.logger.info(
  {
    user: "admin",
    password: "supersecretpassword", // Will become "[REDACTED]"
    metadata: { apiToken: "abc-123" }, // Will become "[REDACTED]"
  },
  "User login"
);
```

## ⚙️ Configuration

```typescript
import { logger } from "@bklarjs/logger";

app.use(
  logger({
    // 'json' or 'pretty'. Defaults to 'pretty' in dev, 'json' in prod.
    format: "json",

    // Add more keys to redact
    redact: ["ssn", "credit_card"],

    // Minimum log level
    level: "debug",

    // Disable automatic request completion logging
    logRequests: true,
  })
);
```

## 🤝 Contributing

Contributions are welcome! Please open an [issue](https://github.com/bernabedev/bklar/issues) or submit a Pull Request to the main `bklar` repository.

## 📄 License

This project is licensed under the **MIT License**.
