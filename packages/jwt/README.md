# @bklarjs/jwt

[![NPM Version](https://img.shields.io/npm/v/@bklarjs/jwt.svg)](https://www.npmjs.com/package/@bklarjs/jwt)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tests](https://img.shields.io/github/actions/workflow/status/bernabedev/bklar/test.yml?branch=main&label=tests&path=packages/jwt)](https://github.com/bernabedev/bklar/actions)

Official JWT (JSON Web Token) authentication middleware for the **[bklar](https://www.npmjs.com/package/bklar)** framework.

It allows you to protect routes, verify tokens, and handle user authentication with a clear, simple, and secure API.

---

## ✨ Features

- 🔒 **Secure by Default:** Built on top of `jose`, a modern, secure, and Web Cryptography API-based library for JWTs.
- 🧩 **Simple Integration:** Add authentication to any route with just a few lines of code.
- 🔧 **Flexible Configuration:** Customize token retrieval, validation algorithms, and optional authentication (`passthrough` mode).
- 🧰 **Helper Functions Included:** Comes with `sign`, `verify`, and `decode` helpers for a complete authentication solution out of the box.
- 🛡️ **Full TypeScript Support:** Automatically augments the `bklar` Context to provide a strongly-typed `ctx.state.jwt` payload in your protected routes.

## 📦 Installation

This package is designed to work with `bklar`. You'll need both installed in your project.

```bash
bun add bklar @bklarjs/jwt
```

## 🚀 Usage

Using the middleware involves two main steps: creating tokens (e.g., during login) and verifying them to protect routes.

### 1. Protecting a Route

First, create an instance of the JWT middleware and apply it to a route you want to protect.

```typescript
import { Bklar } from "bklar";
import { jwt } from "@bklarjs/jwt";

const app = Bklar();

// It's highly recommended to use an environment variable for your secret.
const JWT_SECRET = "a-very-strong-secret-key";

// Create an instance of the auth middleware with your secret
const authMiddleware = jwt({ secret: JWT_SECRET });

app.get(
  "/profile",
  (ctx) => {
    // If we reach this handler, the token is valid.
    // The decoded JWT payload is available at `ctx.state.jwt`.
    const userPayload = ctx.state.jwt;

    return ctx.json({
      message: "Welcome to your protected profile!",
      user: userPayload,
    });
  },
  {
    middlewares: [authMiddleware],
  }
);

app.listen(3000);
```

To access this route, a client must provide a valid JWT in the `Authorization` header:
`Authorization: Bearer <your-token>`

### 2. Creating a Token (Login Flow)

To get a token, you typically create a `/login` endpoint. This package includes a `sign` helper to make this easy.

```typescript
import { Bklar } from "bklar";
import { jwt, sign } from "@bklarjs/jwt";
import { z } from "zod";

const app = Bklar();
const JWT_SECRET = "a-very-strong-secret-key";

// Example user service (in a real app, this would query a database)
const UserService = {
  login: async (email: string, pass: string) => {
    if (email === "user@example.com" && pass === "password123") {
      return { id: "user_123", email, role: "user" };
    }
    return null;
  },
};

// Login endpoint to generate a token
app.post(
  "/login",
  async (ctx) => {
    const { email, password } = ctx.body;
    const user = await UserService.login(email, password);

    if (!user) {
      // The bklar error handler will catch this and respond with a 401.
      throw new UnauthorizedError("Invalid email or password");
    }

    // Sign a new token for the authenticated user
    const token = await sign(
      { sub: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      "HS256",
      { expiresIn: "1h" } // Token is valid for 1 hour
    );

    return ctx.json({ token });
  },
  {
    schemas: {
      body: z.object({
        email: z.string().email(),
        password: z.string(),
      }),
    },
  }
);

app.listen(3000);
```

## ⚙️ Configuration Options

The `jwt()` factory accepts an options object:

- `secret`: (Required) A `string` or `Uint8Array` used to sign and verify tokens.
- `algorithms`: An optional array of allowed signing algorithms (e.g., `['HS256', 'HS512']`). Defaults to `['HS256']`.
- `passthrough`: A boolean. If `true`, the middleware will not throw an error if the token is missing or invalid. `ctx.state.jwt` will simply be `undefined`. Useful for routes with optional authentication. Defaults to `false`.
- `getToken`: A custom function `(ctx: Context) => string | undefined` to extract the token from the request. By default, it looks for a Bearer token in the `Authorization` header.

### Example: Optional Authentication

```typescript
const optionalAuth = jwt({ secret: JWT_SECRET, passthrough: true });

app.get(
  "/posts/:id",
  (ctx) => {
    if (ctx.state.jwt) {
      // User is logged in, show personalized content
      return ctx.json({
        content: "A post.",
        personalizedFor: ctx.state.jwt.sub,
      });
    }
    // User is a guest, show public content
    return ctx.json({ content: "A post." });
  },
  { middlewares: [optionalAuth] }
);
```

## 🧰 API Reference

This package exports the following:

- `jwt(options: JWTOptions): Middleware`: The main factory function that creates the authentication middleware.
- `sign(payload, secret, alg, options)`: An async function to create and sign a new JWT.
- `verify(token, secret, algorithms)`: An async function to verify a token. It throws an error if invalid or returns the payload if valid.
- `decode(token)`: A synchronous function that decodes a token's payload _without_ verifying its signature. **Use with caution.**

## 🤝 Contributing

Contributions are welcome! Please open an [issue](https://github.com/bernabedev/bklar/issues) or submit a Pull Request to the main `bklar` repository.

## 📄 License

This project is licensed under the **MIT License**.
