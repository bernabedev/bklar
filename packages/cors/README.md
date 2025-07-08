# @bklarjs/cors 🌐

[![NPM Version](https://img.shields.io/npm/v/@bklarjs/cors.svg)](https://www.npmjs.com/package/@bklarjs/cors)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tests](https://img.shields.io/github/actions/workflow/status/bernabedev/bklar/test.yml?branch=main&label=tests&path=packages/cors)](https://github.com/bernabedev/bklar/actions)

Official CORS (Cross-Origin Resource Sharing) middleware for the **[bklar](https://www.npmjs.com/package/bklar)** framework.

This package enables your bklar application to handle requests from different origins, which is essential for building modern web applications where the frontend and backend are hosted on separate domains.

---

## ✨ Features

- 🧩 **Simple Integration:** Enable CORS for your entire application with a single line of code.
- 🔧 **Flexible Configuration:** Easily configure allowed origins, methods, headers, and more to fit your security requirements.
- ⚙️ **Automatic Preflight Handling:** Automatically handles complex `OPTIONS` (preflight) requests without any extra effort.
- 🔒 **Sensible Defaults:** Comes with permissive defaults for a quick and easy setup during development.
- 🛡️ **Full TypeScript Support:** Strongly-typed configuration options for a better development experience.

## 📦 Installation

This package is designed to work with `bklar`. You'll need both installed in your project.

```bash
bun add bklar @bklarjs/cors
```

## 🚀 Usage

The most common way to use this middleware is to apply it globally to your application.

### 1. Basic Usage (Development)

For local development, you can enable CORS with its default, permissive settings. This will allow requests from any origin.

```typescript
import { Bklar } from "bklar";
import { cors } from "@bklarjs/cors";

const app = Bklar();

// Apply the CORS middleware globally
app.use(cors());

app.get("/", (ctx) => {
  return ctx.json({ message: "CORS is enabled!" });
});

app.listen(3000);
```

### 2. Production Configuration (Secure)

For production, you should always restrict which origins are allowed to access your API.

```typescript
import { Bklar } from "bklar";
import { cors } from "@bklarjs/cors";

const app = Bklar();

app.use(
  cors({
    // Allow a specific frontend origin
    origin: "https://my-awesome-frontend.com",

    // Allowed HTTP methods
    methods: ["GET", "POST", "PUT", "DELETE"],

    // Allow the frontend to send credentials (e.g., cookies)
    credentials: true,

    // Cache preflight response for 1 day (in seconds)
    maxAge: 86400,
  })
);

app.get("/api/data", (ctx) => {
  return ctx.json({ data: "This is protected by CORS" });
});

app.listen(3000);
```

## ⚙️ Configuration Options

The `cors()` factory accepts an options object:

- `origin`: (Required) Configures the `Access-Control-Allow-Origin` header.
  - `true`: Allows any origin.
  - `string`: Allows a single, specific origin (e.g., `'https://example.com'`).
  - `string[]`: Allows a list of specific origins.
  - `RegExp`: Allows origins matching a regular expression.
  - `(string | RegExp)[]`: Allows a mixed list of specific origins and regular expressions.
- `methods`: An optional `string` or `string[]` of allowed HTTP methods. Defaults to `'GET,HEAD,PUT,PATCH,POST,DELETE'`.
- `allowedHeaders`: An optional `string` or `string[]` of allowed request headers.
- `exposedHeaders`: An optional `string` or `string[]` to configure the `Access-Control-Expose-Headers` header. This allows the client-side code to access custom headers you set in your responses.
- `credentials`: A `boolean`. If `true`, it sets the `Access-Control-Allow-Credentials` header. Defaults to `false`.
- `maxAge`: A `number` that sets the `Access-Control-Max-Age` header in seconds. This specifies how long the results of a preflight request can be cached.

### Example: Multiple Origins

You can easily allow multiple domains, which is useful for staging and production environments.

```typescript
const allowedOrigins = [
  "https://my-awesome-frontend.com",
  "https://staging.my-awesome-frontend.com",
  /localhost:\d{4}$/, // Allow localhost on any 4-digit port
];

app.use(cors({ origin: allowedOrigins }));
```

## 🛠️ How It Works

This middleware inspects incoming requests for an `Origin` header.

1.  **Preflight Requests (`OPTIONS`):** If the request method is `OPTIONS`, the middleware checks if the origin is allowed. If so, it responds immediately with a `204 No Content` status and the appropriate `Access-Control-*` headers, effectively ending the request cycle.
2.  **Actual Requests (e.g., `GET`, `POST`):** For other requests, the middleware checks the origin and, if allowed, attaches the appropriate `Access-Control-Allow-Origin` header to the final response sent by your route handler.

## 🧰 API Reference

This package exports the following:

- `cors(options: CorsOptions): Middleware`: The main factory function that creates the CORS middleware.

## 🤝 Contributing

Contributions are welcome! Please open an [issue](https://github.com/bernabedev/bklar/issues) or submit a Pull Request to the main `bklar` repository.

## 📄 License

This project is licensed under the **MIT License**.
