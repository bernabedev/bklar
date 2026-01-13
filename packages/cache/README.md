# @bklarjs/cache ⚡

[![NPM Version](https://img.shields.io/npm/v/@bklarjs/cache.svg)](https://www.npmjs.com/package/@bklarjs/cache)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

High-performance server-side caching middleware for the **[bklar](https://www.npmjs.com/package/bklar)** framework.

It caches responses in memory (or a custom store like Redis), generates `ETag` headers automatically using Bun's native hashing, and handles `304 Not Modified` responses to save bandwidth.

---

## ✨ Features

- ⚡ **Bun Native Hashing:** Uses `Bun.hash` (Wyhash) for extremely fast ETag generation.
- 💾 **Pluggable Storage:** Comes with an in-memory store but supports any backend (Redis, Memcached, etc.).
- 🧠 **Smart Caching:** Automatically handles query parameters sorting for consistent cache keys.
- 📉 **Bandwidth Saving:** Supports `If-None-Match` headers to return `304 Not Modified`.
- 🧩 **Configurable:** Customize TTL, allowed methods, and key generation strategies.

## 📦 Installation

This package is designed to work with `bklar`.

```bash
bun add bklar @bklarjs/cache
```

## 🚀 Usage

### Basic In-Memory Caching

```typescript
import { Bklar } from "bklar";
import { cache } from "@bklarjs/cache";

const app = Bklar();

// Cache all GET requests for 1 minute (60,000ms)
app.use(cache({ ttl: 60000 }));

app.get("/expensive-data", async (ctx) => {
  // Simulate DB work
  await Bun.sleep(500);
  return ctx.json({ data: "Expensive Result", timestamp: Date.now() });
});

app.listen(3000);
```

**First Request:**

- Latency: ~500ms
- Header: `X-Cache: MISS`

**Second Request:**

- Latency: < 1ms
- Header: `X-Cache: HIT`

### Conditional Revalidation (ETags)

The middleware automatically adds `ETag` headers.

If a client sends `If-None-Match: "W/..."` and the content hasn't changed, the server responds with **304 Not Modified** and an empty body, saving bandwidth.

## ⚙️ Configuration

| Option         | Type              | Default           | Description                                  |
| :------------- | :---------------- | :---------------- | :------------------------------------------- |
| `ttl`          | `number`          | `60000`           | Time to live in milliseconds.                |
| `methods`      | `string[]`        | `['GET', 'HEAD']` | HTTP methods to cache.                       |
| `store`        | `CacheStore`      | `MemoryStore`     | Storage implementation.                      |
| `keyGenerator` | `(ctx) => string` | _(URL + Query)_   | Function to generate unique cache keys.      |
| `addHeaders`   | `boolean`         | `true`            | Whether to add `X-Cache` and `ETag` headers. |

### Using Redis (Example)

You can easily implement the `CacheStore` interface to use Redis.

```typescript
import { createClient } from "redis";
import type { CacheStore, CacheEntry } from "@bklarjs/cache";

class RedisStore implements CacheStore {
  private client = createClient();

  constructor() {
    this.client.connect();
  }

  async get(key: string) {
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : undefined;
  }

  async set(key: string, value: CacheEntry, ttl: number) {
    // Store as JSON string with TTL (converted to seconds)
    await this.client.set(key, JSON.stringify(value), {
      EX: Math.ceil(ttl / 1000),
    });
  }

  async delete(key: string) {
    await this.client.del(key);
  }
}

app.use(cache({ store: new RedisStore() }));
```

## 🤝 Contributing

Contributions are welcome! Please open an [issue](https://github.com/bernabedev/bklar/issues) or submit a Pull Request to the main `bklar` repository.

## 📄 License

This project is licensed under the **MIT License**.
