# @bklarjs/compression 🗜️

[![NPM Version](https://img.shields.io/npm/v/@bklarjs/compression.svg)](https://www.npmjs.com/package/@bklarjs/compression)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

High-performance response compression middleware for the **[bklar](https://www.npmjs.com/package/bklar)** framework.

This package uses **Bun's native** `gzip` and `deflate` implementations to significantly reduce the size of your JSON API responses and static assets, improving load times and reducing bandwidth usage.

---

## ✨ Features

- ⚡ **Native Speed:** Uses `Bun.gzipSync` and `Bun.deflateSync` for maximum performance.
- 🧠 **Smart Defaults:** Automatically compresses JSON, HTML, Text, XML, and SVG. Skips images and binary formats.
- 📉 **Threshold Support:** Only compresses responses larger than 1KB (configurable) to avoid overhead on tiny payloads.
- 🧩 **Content Negotiation:** Respects the client's `Accept-Encoding` header.
- 🛡️ **Vary Header:** Automatically sets `Vary: Accept-Encoding` to prevent caching issues.

## 📦 Installation

This package is designed to work with `bklar`.

```bash
bun add bklar @bklarjs/compression
```

## 🚀 Usage

Apply the middleware globally to compress all eligible responses.

```typescript
import { Bklar } from "bklar";
import { compression } from "@bklarjs/compression";

const app = Bklar();

// Enable compression
app.use(compression());

app.get("/large-data", (ctx) => {
  // This large JSON will be automatically gzipped!
  return ctx.json(Array(1000).fill({ message: "Hello World" }));
});

app.listen(3000);
```

## ⚙️ Configuration

You can customize the compression behavior by passing an options object:

```typescript
app.use(
  compression({
    // Only compress responses larger than 512 bytes
    threshold: 512,

    // Disable deflate if you only want gzip
    encodings: ["gzip"],

    // Custom filter function
    filter: (contentType) => {
      // Default check + explicit support for a custom type
      return (
        contentType.includes("text/") ||
        contentType.includes("application/custom+json")
      );
    },
  })
);
```

| Option      | Type                        | Default               | Description                                              |
| :---------- | :-------------------------- | :-------------------- | :------------------------------------------------------- |
| `threshold` | `number`                    | `1024`                | Minimum size (in bytes) required to apply compression.   |
| `encodings` | `string[]`                  | `['gzip', 'deflate']` | Supported compression algorithms.                        |
| `filter`    | `(type: string) => boolean` | _(See below)_         | Function to determine if a Content-Type is compressible. |

**Default Filter:**
By default, the middleware compresses:

- `text/*` (HTML, CSS, Plain Text)
- `application/json`
- `application/javascript`
- `application/xml`
- `image/svg+xml`

## 🤝 Contributing

Contributions are welcome! Please open an [issue](https://github.com/bernabedev/bklar/issues) or submit a Pull Request to the main `bklar` repository.

## 📄 License

This project is licensed under the **MIT License**.
