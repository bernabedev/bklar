# @bklarjs/static

[![NPM Version](https://img.shields.io/npm/v/@bklarjs/static.svg)](https://www.npmjs.com/package/@bklarjs/static)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Official static file serving middleware for the **[bklar](https://www.npmjs.com/package/bklar)** framework.

This package provides a high-performance and secure way to serve static assets like HTML, CSS, JavaScript, and images directly from your bklar application.

---

## ✨ Features

- 🚀 **High Performance:** Built on top of `Bun.file()`, which serves files directly from the disk with maximum efficiency.
- 📋 **Automatic Headers:** Bun automatically handles `Content-Type`, `ETag`, and `Last-Modified` headers for optimal browser caching.
- 🔒 **Security First:** Protects against directory traversal attacks and does not serve dotfiles by default.
- 🧩 **Simple Integration:** Enable static file serving for your entire application with a single line of code.
- 🔧 **Flexible Configuration:** Configure the root directory and an optional URL prefix to match your project structure.

## 📦 Installation

This package is designed to work with `bklar`. You'll need both installed in your project.

```bash
bun add bklar @bklarjs/static
```

## 🚀 Usage

The most common use case is to serve files from a `public` directory.

### Basic Usage

Create a `public` folder in your project root and place your static files inside it.

```
my-bklar-app/
├── public/
│   ├── index.html
│   └── styles.css
└── index.ts
```

Then, apply the middleware globally in your `index.ts`. It's important to add it **before** your other routes.

```typescript
import { Bklar } from "bklar";
import { serveStatic } from "@bklarjs/static";

const app = Bklar();

// Serve files from the 'public' directory
app.use(serveStatic({ root: "public" }));

// Your API routes go here
app.get("/api/users", (ctx) => {
  return ctx.json([{ id: 1, name: "John Doe" }]);
});

app.listen(3000);
```

Now, you can access your static files in the browser:

- `http://localhost:3000/index.html`
- `http://localhost:3000/styles.css`

### Advanced Usage with a Prefix

If you want to serve your static files under a specific URL path, use the `prefix` option.

```typescript
// Serve files from the 'dist/assets' directory under the '/assets' URL path
app.use(
  serveStatic({
    root: "dist/assets",
    prefix: "/assets",
  })
);
```

A request to `http://localhost:3000/assets/main.js` will now serve the file located at `./dist/assets/main.js`.

## ⚙️ Configuration Options

- `root`: (Required) A `string` specifying the root directory from which to serve static assets.
- `prefix`: An optional `string` for a URL prefix. Requests starting with this path will be mapped to the `root` directory. Defaults to `/`.
- `dotfiles`: A `boolean`. If `true`, allows serving files that start with a dot (e.g., `.well-known/assetlinks.json`). Defaults to `false`.

## 🤝 Contributing

Contributions are welcome! Please open an [issue](https://github.com/bernabedev/bklar/issues) or submit a Pull Request to the main `bklar` repository.

## 📄 License

This project is licensed under the **MIT License**.
