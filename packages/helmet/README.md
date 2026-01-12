# @bklarjs/helmet 🛡️

[![NPM Version](https://img.shields.io/npm/v/@bklarjs/helmet.svg)](https://www.npmjs.com/package/@bklarjs/helmet)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Essential security headers for the **[bklar](https://www.npmjs.com/package/bklar)** framework.

`@bklarjs/helmet` helps secure your apps by setting various HTTP headers. It acts as a shield against common web vulnerabilities like Cross-Site Scripting (XSS), Clickjacking, and Protocol Downgrade attacks.

---

## ✨ Features

- 🔒 **Sets 12+ Security Headers:** Automatically configures headers like `HSTS`, `X-Frame-Options`, `X-Content-Type-Options`, and more.
- ⚙️ **Sensible Defaults:** Comes with a secure default configuration out of the box.
- 🔧 **Highly Configurable:** Enable, disable, or customize every header to fit your specific needs.
- ⚡ **Zero Dependencies:** Built natively for bklar and Bun, avoiding unnecessary bloat.
- 🧩 **TypeScript Ready:** Fully typed configuration object.

## 📦 Installation

This package is designed to work with `bklar`.

```bash
bun add bklar @bklarjs/helmet
```

## 🚀 Usage

Using the middleware is simple. Just apply it globally to your application.

```typescript
import { Bklar } from "bklar";
import { helmet } from "@bklarjs/helmet";

const app = Bklar();

// Apply default security headers
app.use(helmet());

app.get("/", (ctx) => {
  return ctx.json({ message: "I am secure!" });
});

app.listen(3000);
```

### Default Headers Set

By default, `helmet()` sets the following headers:

| Header                              | Value                                 | Description                                                                          |
| :---------------------------------- | :------------------------------------ | :----------------------------------------------------------------------------------- |
| `Content-Security-Policy`           | _(Disabled)_                          | Helps prevent XSS. Disabled by default to avoid breaking apps, see "Advanced" below. |
| `Cross-Origin-Opener-Policy`        | `same-origin`                         | Isolates your document from cross-origin windows.                                    |
| `Cross-Origin-Resource-Policy`      | `same-origin`                         | Blocks other origins from reading your resources.                                    |
| `Origin-Agent-Cluster`              | `?1`                                  | Enables origin-keyed agent clusters.                                                 |
| `Referrer-Policy`                   | `no-referrer`                         | Controls how much referrer info is sent.                                             |
| `Strict-Transport-Security`         | `max-age=15552000; includeSubDomains` | Enforces HTTPS.                                                                      |
| `X-Content-Type-Options`            | `nosniff`                             | Prevents MIME-type sniffing.                                                         |
| `X-DNS-Prefetch-Control`            | `off`                                 | Disables DNS prefetching.                                                            |
| `X-Download-Options`                | `noopen`                              | Prevents IE from executing downloads.                                                |
| `X-Frame-Options`                   | `SAMEORIGIN`                          | Prevents clickjacking (iframe embedding).                                            |
| `X-Permitted-Cross-Domain-Policies` | `none`                                | Restricts Adobe Flash/PDF access.                                                    |
| `X-XSS-Protection`                  | `0`                                   | Disables legacy XSS audtiors (modern best practice).                                 |

## ⚙️ Advanced Configuration

You can override any default by passing an options object.

### Customizing Headers

```typescript
app.use(
  helmet({
    // Disable specific headers
    xFrameOptions: false,

    // Customize HSTS
    strictTransportSecurity: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },

    // Enable Content Security Policy (CSP)
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://trusted-scripts.com"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https://images.com"],
      },
    },
  })
);
```

### Content Security Policy (CSP)

CSP is a powerful tool to prevent XSS, but it requires careful configuration. It is **disabled by default** in this package to ensure your app works immediately upon installation. To enable it:

```typescript
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'", "'unsafe-inline'"],
        "upgrade-insecure-requests": [], // Directives with no values use empty array
      },
    },
  })
);
```

## 🤝 Contributing

Contributions are welcome! Please open an [issue](https://github.com/bernabedev/bklar/issues) or submit a Pull Request to the main `bklar` repository.

## 📄 License

This project is licensed under the **MIT License**.
