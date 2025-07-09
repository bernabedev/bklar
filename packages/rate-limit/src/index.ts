import type { Context, Middleware } from "bklar";
import { TooManyRequestsError } from "bklar/errors";

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
  keyGenerator?: (ctx: Context<any>) => string;

  /**
   * If `true`, adds `X-RateLimit-*` headers to the response.
   * @default true
   */
  standardHeaders?: boolean;
}

// In-memory store for hits
const hits = new Map<string, number[]>();

// Clean up expired hits every `windowMs` to prevent memory leaks.
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of hits.entries()) {
    const filteredTimestamps = timestamps.filter((ts) => ts > now - 60000 * 60); // Keep hits for 1 hour
    if (filteredTimestamps.length > 0) {
      hits.set(key, filteredTimestamps);
    } else {
      hits.delete(key);
    }
  }
}, 60000 * 30); // Cleanup every 30 minutes

/**
 * A function to generate a key from the client's IP address.
 */
const defaultKeyGenerator = (ctx: Context<any>): string => {
  // @ts-expect-error req is not defined on Context
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

  const rateLimitMiddleware: Middleware = (ctx) => {
    const key = keyGenerator(ctx);
    const now = Date.now();
    const windowStart = now - windowMs;

    // Get current hits for this key
    const currentHits = hits.get(key) || [];

    // Filter out hits that are outside the current window
    const recentHits = currentHits.filter(
      (timestamp) => timestamp > windowStart
    );

    if (recentHits.length >= max) {
      if (standardHeaders) {
        ctx.state.rateLimitHeaders = {
          "X-RateLimit-Limit": max,
          "X-RateLimit-Remaining": 0,
          "X-RateLimit-Reset": Math.ceil((recentHits[0] + windowMs) / 1000),
        };
      }
      throw new TooManyRequestsError(message);
    }

    // Add the current hit
    recentHits.push(now);
    hits.set(key, recentHits);

    if (standardHeaders) {
      const remaining = max - recentHits.length;
      ctx.state.rateLimitHeaders = {
        "X-RateLimit-Limit": max,
        "X-RateLimit-Remaining": remaining,
        // Reset time is based on the first hit in the current window
        "X-RateLimit-Reset": Math.ceil((recentHits[0] + windowMs) / 1000),
      };
    }
  };

  return rateLimitMiddleware;
}

// Module Augmentation for type safety
declare module "bklar" {
  interface State {
    rateLimitHeaders?: {
      "X-RateLimit-Limit": number;
      "X-RateLimit-Remaining": number;
      "X-RateLimit-Reset": number;
    };
  }
}
