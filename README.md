¡Absolutamente! Actualizar el `README` para reflejar el nuevo y más sencillo proceso de inicio es fundamental. Un flujo de "Getting Started" claro y directo es lo más importante para atraer a nuevos usuarios.

He reestructurado la sección de inicio para que el comando `bun create bklar` sea lo primero que vea un desarrollador. Esto elimina la confusión y los guía por el camino recomendado.

Aquí tienes el `README.md` actualizado en inglés.

---

# bklar 🐰

[![NPM Version](https://img.shields.io/npm/v/bklar.svg)](https://www.npmjs.com/package/bklar)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tests](https://img.shields.io/github/actions/workflow/status/bernabedev/bklar/test.yml?branch=main&label=tests)](https://github.com/bernabedev/bklar/actions)

**bklar** is a minimal, fast, and modern web framework for [Bun](https://bun.sh/). Designed with a first-class developer experience (DX), it allows you to build robust REST APIs with a clear syntax and outstanding performance.

Inspired by simplicity, bklar integrates validation with [Zod](https://zod.dev/) and an intuitive routing system, so you can focus on your application's logic, not the boilerplate.

---

## ✨ Key Features

- 🚀 **Incredibly Fast:** Built on top of Bun, one of ahe fastest JavaScript runtimes.
- 🔒 **Integrated Validation:** Define schemas for `body`, `query`, and `params` using Zod. Types are automatically inferred in your handlers.
- 🎨 **Clear & Expressive Syntax:** A fluent and easy-to-learn API that you'll love to use.
- 🧩 **Middlewares & Groups:** Logically organize your code with middlewares at the global, group, or route level.
- 📝 **Built-in Logger:** A colorful and useful logger is enabled by default and is fully customizable.
- 📦 **Extensible Ecosystem:** Designed to be extended with packages like `@bklar/jwt`.
- 🛡️ **End-to-End Type-Safety:** Leverage the full power of TypeScript without complex configurations.

## 🚀 Getting Started

Creating a new bklar project is simple with the official command-line tool. You just need to have Bun installed.

```bash
bun create bklar my-app
```

This command will create a new directory called `my-app`, scaffold a new project with all the necessary files, and provide you with the next steps.

Once it's done, navigate to your new project and start the development server:

```bash
cd my-app
bun install
bun run dev
```

Your new application is now running at `http://localhost:3000`!

## ✨ A Look Inside

The `bun create` command generates a simple, well-structured project for you. Here's a look at the core concepts in your `index.ts` file:

```typescript
import { Bklar } from "bklar";

// 1. Create an application instance
const app = Bklar();

// 2. Define your routes
app.get("/", (ctx) => {
  return ctx.json({ message: "Welcome to bklar! 🐰" });
});

app.get("/hello/:name", (ctx) => {
  const { name } = ctx.params;
  return ctx.json({ greeting: `Hello, ${name}!` });
});

// 3. Start the server
app.listen(3000);
```

## 深入 Guide

### Validation with Zod

Define validation schemas, and bklar will handle the rest, including automatic error responses and inferred types in your `Context`.

```typescript
import { Bklar } from "bklar";
import { z } from "zod";

const app = Bklar();

const createUserSchema = z.object({
  name: z.string().min(3),
  email: z.string().email(),
});

app.post(
  "/users",
  (ctx) => {
    // `ctx.body` is fully typed and validated.
    // ctx.body: { name: string, email: string }
    const newUser = ctx.body;

    // ... logic to save the user ...

    return ctx.json({ id: 1, ...newUser }, 201);
  },
  {
    schemas: {
      body: createUserSchema,
    },
  }
);

app.listen(3000);
```

### Middlewares

Add cross-cutting logic using middlewares at any level.

```typescript
import { Bklar, type Middleware } from "bklar";

const app = Bklar();

// Global middleware (runs on every request)
app.use(async (ctx) => {
  console.log(`Request received: ${ctx.req.method} ${ctx.req.url}`);
});

// Route-specific middleware
const authMiddleware: Middleware = (ctx) => {
  const token = ctx.req.headers.get("Authorization");
  if (token !== "Bearer my-secret-token") {
    // You can throw an error or return a response to stop the flow
    return ctx.json({ error: "Unauthorized" }, 401);
  }
  ctx.state.user = { id: 123, role: "admin" };
};

app.get(
  "/profile",
  (ctx) => {
    // ctx.state.user is available here
    return ctx.json({ user: ctx.state.user });
  },
  {
    middlewares: [authMiddleware],
  }
);

app.listen(3000);
```

### Route Groups

Organize your routes and apply middlewares to a set of them easily.

```typescript
app.group(
  "/admin",
  (r) => {
    // All routes within this group will use authMiddleware

    r.get("/dashboard", (ctx) => {
      return ctx.json({ message: "Welcome to the admin dashboard!" });
    });

    r.post("/posts", (ctx) => {
      // ... create a post ...
    });
  },
  [authMiddleware] // Middleware applied to the entire group
);
```

## ⚙️ Configuration

You can customize bklar's behavior when initializing the application.

```typescript
import { Bklar } from "bklar";

const app = Bklar({
  // Disable the default logger
  logger: false,
});
```

## 🌳 Ecosystem

- **[@bklar/jwt](https://npmjs.com/package/@bklar/jwt):** Middleware for JSON Web Token authentication. (Create this package!)

## 🤝 Contributing

Contributions are welcome! If you have ideas, suggestions, or find a bug, please open an [issue](https://github.com/bernabedev/bklar/issues) or submit a Pull Request.

## 📄 License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.
