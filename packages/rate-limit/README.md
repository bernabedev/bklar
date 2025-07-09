# @bklarjs/rate-limit

[![NPM Version](https://img.shields.io/npm/v/@bklarjs/rate-limit.svg)](https://www.npmjs.com/package/@bklarjs/rate-limit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Official rate-limiting middleware for the **[bklar](https://www.npmjs.com/package/bklar)** framework. Protect your APIs from brute-force attacks and abuse by limiting the number of requests a client can make in a given time window.

---

## ✨ Features

- 🚀 **High Performance:** Uses an efficient in-memory store (`Map`) for fast lookups.
- 🔧 **Highly Configurable:** Customize the time window, maximum requests, error messages, and more.
- 🆔 **Flexible Client Identification:** Defaults to using the client's IP address but allows for a custom `keyGenerator` function to rate-limit based on API keys, user IDs, etc.
- 📋 **Standard Headers:** Automatically adds `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` headers to responses.
- 🛡️ **Full TypeScript Support:** Strongly-typed configuration for a superior development experience.

## 📦 Installation

This package is designed to work with `bklar`. You'll need both installed in your project.

```bash
bun add bklar @bklarjs/rate-limit
```

## 🚀 Usage

The most common use case is to apply the rate-limiter globally to all requests.

```typescript
import { Bklar } from "bklar";
import { Bklar as rateLimit } from "@bklarjs/rate-limit";

const app = Bklar();

// Apply the rate-limiter globally:
// Allow 100 requests per 15 minutes from each IP address.
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
  })
);

app.get("/", (ctx) => {
  return ctx.json({ message: "This endpoint is rate-limited." });
});

app.listen(3000);
```

If a client exceeds the limit, `bklar` will automatically respond with a `429 Too Many Requests` status and a JSON error message.

### Advanced Usage: Protecting Specific Routes

You can also apply different rate limits to specific routes or groups.

```typescript
import { Bklar } from "bklar";
import { Bklar as rateLimit } from "@bklarjs/rate-limit";

const app = Bklar();

// A stricter rate limit for a sensitive endpoint like /login
const loginRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5, // Limit each IP to 5 login attempts per 10 minutes
  message: "Too many login attempts. Please try again in 10 minutes.",
});

app.post(
  "/login",
  (ctx) => {
    // ... login logic
  },
  {
    middlewares: [loginRateLimiter],
  }
);
```

## ⚙️ Configuration Options

- `windowMs`: The time window in milliseconds. Defaults to `60000`.
- `max`: The maximum number of requests to allow during the `windowMs`. Defaults to `50`.
- `message`: Custom error message string. Defaults to `"Too many requests, please try again later."`.
- `standardHeaders`: A boolean to enable/disable `X-RateLimit-*` headers. Defaults to `true`.
- `keyGenerator`: A function `(ctx: Context) => string` to generate a unique key for client identification. Defaults to using `X-Client-IP` header.

### Example: Custom Key Generator

Rate-limit based on a user ID from a JWT payload.

```typescript
import { Bklar as rateLimit } from "@bklarjs/rate-limit";
import { jwt } from "@bklarjs/jwt";

// Assume authMiddleware populates ctx.state.jwt
const authMiddleware = jwt({ secret: "secret" });

const userRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator: (ctx) => {
    // Use the user's ID if authenticated, otherwise fall back to IP
    return ctx.state.jwt?.sub || ctx.req.headers.get("X-Client-IP");
  },
});

app.post(
  "/api/posts",
  (ctx) => {
    // ... create post
  },
  {
    middlewares: [authMiddleware, userRateLimiter],
  }
);
```

> **Note:** The default store is in-memory, which means it is reset when the server restarts and is not shared across multiple server processes. For a distributed environment, you would need to implement a custom store (e.g., using Redis).

## 🤝 Contributing

Contributions are welcome! Please open an [issue](https://github.com/bernabedev/bklar/issues) or submit a Pull Request to the main `bklar` repository.

## 📄 License

This project is licensed under the **MIT License**.
