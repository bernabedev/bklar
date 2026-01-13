import type { Middleware, InferContext } from "bklar";
import { MemoryStore } from "./memory-store";

// --- Types ---

export interface CacheEntry {
  body: ArrayBuffer;
  status: number;
  headers: Record<string, string>;
  timestamp: number;
}

export interface CacheStore {
  get(key: string): Promise<CacheEntry | undefined> | CacheEntry | undefined;
  set(key: string, value: CacheEntry, ttl: number): Promise<void> | void;
  delete(key: string): Promise<void> | void;
}

export interface CacheOptions {
  /**
   * Time to live in milliseconds.
   * @default 60000 (1 minute)
   */
  ttl?: number;

  /**
   * HTTP methods to cache.
   * @default ["GET", "HEAD"]
   */
  methods?: string[];

  /**
   * Custom storage backend.
   * @default MemoryStore
   */
  store?: CacheStore;

  /**
   * Custom key generator.
   * Default: `${method}:${path}?${query}`
   */
  keyGenerator?: (ctx: InferContext<any>) => string;

  /**
   * If true, adds X-Cache (HIT/MISS) and ETag headers.
   * @default true
   */
  addHeaders?: boolean;
}

// --- Middleware ---

export function cache(options: CacheOptions = {}): Middleware {
  const ttl = options.ttl ?? 60000;
  const methods = new Set(options.methods ?? ["GET", "HEAD"]);
  const store = options.store ?? new MemoryStore();
  const addHeaders = options.addHeaders ?? true;

  const generateKey =
    options.keyGenerator ??
    ((ctx) => {
      const url = new URL(ctx.req.url);
      // Sort query params to ensure consistent keys
      url.searchParams.sort();
      return `${ctx.req.method}:${url.pathname}${url.search}`;
    });

  return async (ctx, next) => {
    // 1. Skip unsupported methods
    if (!methods.has(ctx.req.method)) {
      return next();
    }

    const key = generateKey(ctx);

    // 2. Check Cache
    const cached = await store.get(key);

    if (cached) {
      // Check for If-None-Match (ETag support)
      const clientEtag = ctx.req.headers.get("If-None-Match");
      const serverEtag = cached.headers["ETag"];

      if (clientEtag && serverEtag && clientEtag === serverEtag) {
        return new Response(null, { status: 304, headers: cached.headers });
      }

      const headers = new Headers(cached.headers);
      if (addHeaders) headers.set("X-Cache", "HIT");

      return new Response(cached.body, {
        status: cached.status,
        headers,
      });
    }

    // 3. Execute Downstream
    const res = await next();

    // Resolve response object (Bklar v2 pattern)
    const response =
      res instanceof Response
        ? res
        : (ctx as any)._res instanceof Response
        ? (ctx as any)._res
        : null;

    // 4. Cache Eligibility Check
    // We only cache 200 OK responses
    if (!response || response.status !== 200) {
      return res;
    }

    // 5. Clone and Consume
    // We must clone because we need to read the body buffer, which consumes the stream
    const buffer = await response.clone().arrayBuffer();

    // 6. Generate ETag
    // Use Bun's extremely fast Wyhash for ETag generation on the buffer
    const hash = Bun.hash(new Uint8Array(buffer));
    const etag = `W/"${hash.toString(16)}"`;

    const headersObj: Record<string, string> = {};
    response.headers.forEach((v: string, k: string) => (headersObj[k] = v));
    headersObj["ETag"] = etag;

    // 7. Save to Store
    const entry: CacheEntry = {
      body: buffer,
      status: response.status,
      headers: headersObj,
      timestamp: Date.now(),
    };

    // Fire and forget set (don't block response)
    Promise.resolve(store.set(key, entry, ttl)).catch(console.error);

    // 8. Return Response with Headers
    const finalHeaders = new Headers(response.headers);
    finalHeaders.set("ETag", etag);
    if (addHeaders) finalHeaders.set("X-Cache", "MISS");

    return new Response(buffer, {
      status: response.status,
      headers: finalHeaders,
    });
  };
}

// Export Memory Store for manual usage/testing
export * from "./memory-store";
