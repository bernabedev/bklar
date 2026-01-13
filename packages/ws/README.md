# @bklarjs/ws 🔌

[![NPM Version](https://img.shields.io/npm/v/@bklarjs/ws.svg)](https://www.npmjs.com/package/@bklarjs/ws)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Official WebSocket support for the **[bklar](https://www.npmjs.com/package/bklar)** framework.

This package wraps Bun's native, high-performance `ServerWebSocket` implementation, allowing you to define WebSocket routes alongside your HTTP routes while retaining access to your application context (middleware, authentication, etc.).

---

## ✨ Features

- ⚡ **Native Performance:** Built directly on `Bun.serve({ websocket })` for maximum throughput.
- 🧩 **Integrated Context:** Access your full `ctx` inside WebSocket handlers (including `ctx.state.user` from auth middleware).
- 📡 **Easy API:** Define WS routes (`app.ws`) just like HTTP routes.
- 🛡️ **Middleware Support:** HTTP upgrade requests run through your existing middleware chain (Auth, CORS, etc.) before connecting.

## 📦 Installation

This package is designed to work with `bklar`.

```bash
bun add bklar @bklarjs/ws
```

## 🚀 Usage

Wrap your app instance with `websocket()` to enable the feature.

```typescript
import { Bklar } from "bklar";
import { websocket } from "@bklarjs/ws";

// 1. Initialize app and wrap it
const app = websocket(Bklar());

// 2. Define a WebSocket route
app.ws("/chat", {
  open(ws) {
    console.log("Client connected!");
    ws.send("Welcome to the chat!");

    // Subscribe to a topic (Pub/Sub)
    ws.subscribe("global-chat");
  },
  message(ws, message) {
    console.log("Received:", message);

    // Publish to everyone in the topic
    ws.publish("global-chat", `User said: ${message}`);
  },
  close(ws) {
    console.log("Client disconnected");
  },
});

// 3. Start server
app.listen(3000);
```

### Accessing Context (Authentication)

Since the WebSocket upgrade starts as an HTTP GET request, it passes through your `bklar` middleware chain. You can access the resulting context in `ws.data.ctx`.

```typescript
import { jwt } from "@bklarjs/jwt";

// Add Auth Middleware
const auth = jwt({ secret: "s3cret" });

app.ws("/secure-chat", {
  open(ws) {
    // Access the authenticated user from ctx.state
    const user = ws.data.ctx.state.jwt;

    console.log(`User ${user.sub} connected.`);
    ws.send(`Hello, ${user.name}!`);
  },
});

// Note: Ensure the route runs the middleware.
// Since app.ws registers a GET route under the hood, you can strictly enforce middleware
// by using groups or global middleware before defining the WS route.
app.use(auth); // Apply globally for this example
```

## ⚙️ API Reference

### `websocket(app)`

Updates the `app` instance to support WebSockets. Returns the augmented app.

### `app.ws(path, handlers)`

Registers a WebSocket handler for a specific path.

- `path`: URL path (e.g., `/ws`).
- `handlers`: Object containing event hooks:
  - `open(ws)`: Called when connection opens.
  - `message(ws, msg)`: Called when a message is received.
  - `close(ws, code, reason)`: Called on disconnection.
  - `drain(ws)`: Called when backpressure is relieved.

### `ws.data.ctx`

The `Context` object from the initial HTTP Upgrade request. Use this to access headers, query parameters, or state injected by middleware.

## 🤝 Contributing

Contributions are welcome! Please open an [issue](https://github.com/bernabedev/bklar/issues) or submit a Pull Request to the main `bklar` repository.

## 📄 License

This project is licensed under the **MIT License**.
