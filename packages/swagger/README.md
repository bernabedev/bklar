# @bklarjs/swagger

[![NPM Version](https://img.shields.io/npm/v/@bklarjs/swagger.svg)](https://www.npmjs.com/package/@bklarjs/swagger)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Official OpenAPI (v3.1) documentation generator for the **[bklar](https://www.npmjs.com/package/bklar)** framework.

This package automatically generates an `openapi.json` specification by inspecting your routes and their Zod schemas. It also serves beautiful, interactive API documentation UIs using both **Swagger UI** and **Scalar**.

---

## ✨ Features

- 📝 **Code-First Documentation:** Document your API endpoints directly in your route definitions. No need to maintain a separate YAML or JSON file.
- 🤖 **Automatic Schema Generation:** Automatically converts your Zod schemas for `params`, `query`, and `body` into JSON Schema for your OpenAPI specification.
- 🎨 **Beautiful UIs Included:** Serves two popular and interactive API documentation UIs out of the box:
  - **Swagger UI:** The industry standard, highly recognized documentation interface.
  - **Scalar:** A modern, clean, and beautifully designed alternative.
- 🔐 **Authentication Support:** Easily add Bearer (JWT) authentication to your documentation with a single flag.
- 🧩 **Simple Integration:** Set up your entire API documentation with just a few lines of code.
- 🛡️ **Full TypeScript Support:** Strongly-typed options for a superior development experience.

## 📦 Installation

This package is designed to work with `bklar` and `zod`. You'll need all three installed in your project.

```bash
bun add bklar @bklarjs/swagger zod
```

## 🚀 Quick Start

Integrating API documentation is a two-step process: documenting your routes and then setting up the documentation endpoints.

### 1. Document Your Routes

Add a `doc` property to the options object of your routes. This is where you provide metadata for your API documentation.

```typescript
import { Bklar } from "bklar";
import { z } from "zod";

const app = Bklar();

const userSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
});

app.get(
  "/users/:id",
  (ctx) => {
    // Your handler logic...
    return ctx.json({
      id: ctx.params.id,
      name: "John Doe",
      email: "john.doe@example.com",
    });
  },
  {
    schemas: {
      params: z.object({ id: z.string().uuid() }),
    },
    // Add documentation here
    doc: {
      summary: "Get a single user by ID",
      description: "Returns a user object if found.",
      tags: ["Users"],
      responses: {
        "200": {
          description: "Successful response.",
          content: { "application/json": { schema: userSchema } }, // You can even use Zod schemas for responses!
        },
        "404": { description: "User not found." },
      },
    },
  }
);
```

### 2. Set Up the Documentation UI

After all your routes have been defined, call the `setup()` function from the swagger package on your `app` instance. This should be done just before `app.listen()`.

```typescript
import { Bklar } from "bklar";
import { swagger } from "@bklarjs/swagger";
// ... your other imports and route definitions

const app = Bklar();

// --- ALL YOUR app.get, app.post, etc. ROUTES GO HERE ---

// Setup Swagger after all routes are defined
swagger({
  path: "/documentation", // The base path for your documentation
  bearerAuth: true, // Enable global Bearer authentication
  openapi: {
    title: "My Awesome API",
    version: "1.2.0",
    description: "This is the official documentation for My Awesome API.",
  },
}).setup(app);

app.listen(3000);
```

Enabling `bearerAuth: true` will add an "Authorize" button to the Swagger UI, allowing you to test protected endpoints.

### 3. Access Your Documentation

Now, start your server (`bun run dev`) and visit the following endpoints in your browser:

- **`http://localhost:3000/documentation/swagger`** - View the Swagger UI.
- **`http://localhost:3000/documentation/scalar`** - View the Scalar UI.
- **`http://localhost:3000/documentation/json`** - View the raw `openapi.json` specification.

## 🔐 Adding Authentication

You can secure your endpoints in two ways:

### Global Authentication

Set `bearerAuth: true` in the main `swagger` configuration. This applies Bearer (JWT) authentication to all endpoints by default.

```ts
swagger({
  bearerAuth: true,
  openapi: {
    title: "My Secure API",
  },
}).setup(app);
```

### Per-Endpoint Authentication

You can specify security requirements for individual routes within the `doc` object. This is useful for public endpoints in an otherwise protected API, or for routes that use different security schemes.

To mark a specific endpoint as protected, add the `security` property:

```ts
app.get(
  "/profile",
  (ctx) => {
    /* ... */
  },
  {
    doc: {
      summary: "Get the current user's profile",
      tags: ["Users"],
      security: [{ bearerAuth: [] }], // This endpoint requires bearer auth
      responses: {
        /* ... */
      },
    },
  }
);
```

To make an endpoint public when global authentication is enabled, use an empty array for `security`:

```ts
app.get("/health", (ctx) => ctx.json({ status: "ok" }), {
  doc: {
    summary: "Health check endpoint",
    tags: ["System"],
    security: [], // This endpoint is public
  },
});
```

## ⚙️ Configuration Options

The `swagger()` factory accepts an options object:

- `path`: The base path under which the documentation will be served. Defaults to `/docs`.
- `bearerAuth`: A boolean to enable global Bearer (JWT) authentication support in the UI. Defaults to `false`.
- `openapi`: An object to configure the `info`, `components`, and `security` sections of your OpenAPI specification.
  - `title`: The title of your API. Defaults to `"bklar API"`.
  - `version`: The version of your API. Defaults to `"1.0.0"`.
  - `description`: A short description of your API.

### `doc` Object Properties

The `doc` object you add to your routes can contain the following standard OpenAPI operation fields:

- `summary`: A short summary of what the operation does.
- `description`: A verbose explanation of the operation behavior.
- `tags`: An array of strings used for grouping operations in the UI (e.g., `['Users', 'Authentication']`).
- `responses`: An object describing the possible responses from the operation.
- `security`: An array defining the security requirements for this specific operation.
- ...and other valid OpenAPI operation fields.

## 🤝 Contributing

This package is part of the main `bklar` repository. Contributions are welcome! Please open an [issue](https://github.com/bernabedev/bklar/issues) or submit a Pull Request.

## 📄 License

This project is licensed under the **MIT License**.
