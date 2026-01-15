# bklar 🐰

[![NPM Version](https://img.shields.io/npm/v/bklar.svg)](https://www.npmjs.com/package/bklar)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tests](https://img.shields.io/github/actions/workflow/status/bernabedev/bklar/test.yml?branch=main&label=tests)](https://github.com/bernabedev/bklar/actions)

**bklar** (pronounced *buh-klar*) is a minimalist, high-performance web framework built specifically for [Bun](https://bun.sh/).

Designed for production excellence, it combines the raw speed of Bun with a robust ecosystem, first-class TypeScript support, and a developer experience inspired by the best modern frameworks.

---

## ✨ Features

- 🚀 **Native Speed:** Built directly on `Bun.serve` and `Bun.file`. No Node.js compatibility overhead.
- 🛡️ **Type-Safe Validation:** Integrated [Zod](https://zod.dev/) support. Inputs and outputs are validated and strongly typed automatically.
- 🔌 **Native WebSockets:** Real-time support integrated directly into the core router.
- 🔋 **Batteries Included:** A complete ecosystem of official packages for Security, Performance, and Utilities.
- 📝 **Auto-Documentation:** Generate OpenAPI 3.1 specs and Swagger UI automatically from your code.
- 🎨 **Minimalist API:** A clear, expressive syntax that stays out of your way.

## 🚀 Getting Started

The best way to start is using the official CLI. It provides interactive templates for different use cases.

```bash
bun create bklar my-app
```

Navigate to your new project and start the server:

```bash
cd my-app
bun install
bun run dev
```

## ⚡ Quick Look

Here is a complete API endpoint with validation, parameters, and JSON response.

```typescript
import { Bklar } from "bklar";
import { z } from "zod";

const app = Bklar();

// GET /users/123
app.get(
  "/users/:id",
  (ctx) => {
    // ctx.params.id is strictly typed as a number here!
    return ctx.json({ 
      id: ctx.params.id, 
      name: "Bun User" 
    });
  },
  {
    schemas: {
      // Automatic validation and coercion
      params: z.object({ id: z.coerce.number() })
    }
  }
);

app.listen(3000);
```

## 🔌 Real-Time (WebSockets)

Bklar v2 supports WebSockets natively. No external plugins required.

```typescript
app.ws("/chat", {
  open(ws) {
    console.log("Client connected");
    ws.subscribe("global-chat");
  },
  message(ws, msg) {
    // Native Pub/Sub support
    ws.publish("global-chat", `New message: ${msg}`);
  }
});
```

## 🌳 The Ecosystem

Bklar v2 comes with a suite of official, high-performance packages designed to work perfectly together.

### Security
- **[@bklarjs/helmet](https://npmjs.com/package/@bklarjs/helmet):** Secure your app with essential HTTP headers (CSP, HSTS, XSS).
- **[@bklarjs/cors](https://npmjs.com/package/@bklarjs/cors):** Cross-Origin Resource Sharing middleware.
- **[@bklarjs/jwt](https://npmjs.com/package/@bklarjs/jwt):** JSON Web Token authentication.
- **[@bklarjs/rate-limit](https://npmjs.com/package/@bklarjs/rate-limit):** Protection against brute-force and DDoS attacks.

### Performance
- **[@bklarjs/cache](https://npmjs.com/package/@bklarjs/cache):** Server-side caching with ETag support and pluggable stores (Redis/Memory).
- **[@bklarjs/compression](https://npmjs.com/package/@bklarjs/compression):** Gzip/Deflate compression using Bun's native APIs.

### Utilities
- **[@bklarjs/logger](https://npmjs.com/package/@bklarjs/logger):** Production-ready structured logging (JSON) with request correlation.
- **[@bklarjs/upload](https://npmjs.com/package/@bklarjs/upload):** Handle multipart file uploads (Memory or Disk).
- **[@bklarjs/swagger](https://npmjs.com/package/@bklarjs/swagger):** Auto-generated OpenAPI documentation and Swagger UI.
- **[@bklarjs/cron](https://npmjs.com/package/@bklarjs/cron):** Schedule background tasks and jobs.
- **[@bklarjs/static](https://npmjs.com/package/@bklarjs/static):** Serve static files efficiently.

## 🛡️ Error Handling

Throw standard errors from anywhere in your application, and Bklar will handle the response codes for you.

```typescript
import { NotFoundError } from "bklar/errors";

app.get("/item/:id", (ctx) => {
  const item = db.find(ctx.params.id);
  
  if (!item) {
    // Automatically returns 404 with JSON body
    throw new NotFoundError("Item not found");
  }
  
  return ctx.json(item);
});
```

## 🤝 Contributing

Contributions are welcome! If you have ideas, suggestions, or find a bug, please open an [issue](https://github.com/bernabedev/bklar/issues) or submit a Pull Request.

## 📄 License

This project is licensed under the **MIT License**.