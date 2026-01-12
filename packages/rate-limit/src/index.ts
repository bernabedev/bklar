import type { InferContext, Middleware } from "bklar";

/**
 * Options for the rate-limiting middleware.
 */
export interface RateLimitOptions {
  /**
   * The time window in milliseconds.
   * @default 60000 (1 minute)
   */
  windowMs?: number;

  /**
   * The maximum number of connections to allow during the `windowMs`.
   * @default 50
   */
  max?: number;

  /**
   * The error message to return when the rate limit is exceeded.
   */
  message?: string;

  /**
   * A function to generate a unique key for each client.
   * By default, it uses the client's IP address.
   * @param ctx The bklar context.
   * @returns A string identifier for the client.
   */
  keyGenerator?: (ctx: InferContext<any>) => string;

  /**
   * If `true`, adds `X-RateLimit-*` headers to the response.
   * @default true
   */
  standardHeaders?: boolean;
}

/**
 * A function to generate a key from the client's IP address.
 */
const defaultKeyGenerator = (ctx: InferContext<any>): string => {
  return ctx.req.headers.get("X-Client-IP") || "127.0.0.1";
};

/**
 * Creates a rate-limiting middleware for the bklar framework.
 * @param options Configuration for the rate-limiter.
 * @returns A bklar Middleware function.
 */
export function rateLimit(options: RateLimitOptions = {}): Middleware {
  const {
    windowMs = 60000, // 1 minute
    max = 50,
    message = "Too many requests, please try again later.",
    keyGenerator = defaultKeyGenerator,
    standardHeaders = true,
  } = options;

  // In-memory store specific to this middleware instance.
  // This allows different rate limits for different route groups.
  const hits = new Map<string, number[]>();

  // Cleanup interval to prevent memory leaks
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of hits.entries()) {
      // Keep hits that are still within a plausible window (e.g. 2x window)
      // or just remove empty/old entries
      const filtered = timestamps.filter((ts) => ts > now - windowMs);
      if (filtered.length === 0) {
        hits.delete(key);
      } else {
        hits.set(key, filtered);
      }
    }
  }, windowMs);

  // Unref the interval so it doesn't prevent the process from exiting (if supported by runtime)
  if (cleanup.unref) cleanup.unref();

  return async (ctx, next) => {
    const key = keyGenerator(ctx);
    const now = Date.now();
    const windowStart = now - windowMs;

    // 1. Get and Filter Hits
    const currentHits = hits.get(key) || [];
    const recentHits = currentHits.filter(
      (timestamp) => timestamp > windowStart
    );

    // 2. Calculate Header Values
    const currentUsage = recentHits.length;
    const remaining = Math.max(0, max - currentUsage);

    // Reset time is based on the oldest hit in the window + window duration
    // If no hits, reset is now + window
    const resetTime =
      recentHits.length > 0
        ? Math.ceil((recentHits[0] + windowMs) / 1000)
        : Math.ceil((now + windowMs) / 1000);

    const headers: Record<string, string> = {};

    if (standardHeaders) {
      headers["X-RateLimit-Limit"] = max.toString();
      headers["X-RateLimit-Remaining"] = remaining.toString();
      headers["X-RateLimit-Reset"] = resetTime.toString();
    }

    // 3. Check Limit
    if (currentUsage >= max) {
      // Stop the request chain here.
      // We return a direct response instead of throwing an error so we can
      // attach the headers reliably.
      headers["Retry-After"] = Math.ceil(windowMs / 1000).toString();

      // Since hits are capped by logic (we don't push if full), we don't increment here
      // to avoid punishing blocked requests excessively, or we could increment to keep extending the block.
      // Standard practice varies; usually blocked requests don't count towards the 'valid' limit but
      // might trigger a ban. Here we just block.

      return ctx.json({ message }, 429, headers);
    }

    // 4. Record Hit
    recentHits.push(now);
    hits.set(key, recentHits);

    // Update remaining for the success response
    if (standardHeaders) {
      headers["X-RateLimit-Remaining"] = Math.max(
        0,
        max - recentHits.length
      ).toString();
    }

    // 5. Execute Next
    const response = await next();

    // 6. Inject Headers into Response
    const targetResponse =
      response instanceof Response
        ? response
        : (ctx as any)._res instanceof Response
        ? (ctx as any)._res
        : null;

    if (targetResponse && standardHeaders) {
      for (const [k, v] of Object.entries(headers)) {
        targetResponse.headers.set(k, v);
      }
      return targetResponse;
    }

    return response;
  };
}
