import type { Middleware } from "bklar";

export interface CorsOptions {
  /**
   * Configures the `Access-Control-Allow-Origin` header.
   * - `true`: Allows any origin.
   * - `string`: Allows a single specific origin.
   * - `string[]`: Allows a list of specific origins.
   * - `RegExp`: Allows origins matching a regular expression.
   * @default true
   */
  origin?: boolean | string | RegExp | (string | RegExp)[];

  /**
   * Configures the `Access-Control-Allow-Methods` header.
   * @default "GET,HEAD,PUT,PATCH,POST,DELETE"
   */
  methods?: string | string[];

  /**
   * Configures the `Access-Control-Allow-Headers` header.
   */
  allowedHeaders?: string | string[];

  /**
   * Configures the `Access-Control-Expose-Headers` header.
   */
  exposedHeaders?: string | string[];

  /**
   * Configures the `Access-Control-Allow-Credentials` header.
   * @default false
   */
  credentials?: boolean;

  /**
   * Configures the `Access-Control-Max-Age` header (in seconds).
   */
  maxAge?: number;
}

const toArray = (value?: string | string[]) =>
  Array.isArray(value) ? value : value?.split(",").map((s) => s.trim()) || [];

export function cors(options: CorsOptions = {}): Middleware {
  const config = {
    origin: options.origin ?? true,
    methods: toArray(options.methods ?? "GET,HEAD,PUT,PATCH,POST,DELETE").join(
      ","
    ),
    allowedHeaders: toArray(options.allowedHeaders).join(","),
    exposedHeaders: toArray(options.exposedHeaders).join(","),
    credentials: options.credentials ?? false,
    maxAge: options.maxAge,
  };

  const isOriginAllowed = (origin: string): boolean => {
    if (config.origin === true) return true;
    if (typeof config.origin === "string") return config.origin === origin;
    if (Array.isArray(config.origin)) {
      return config.origin.some((o) =>
        typeof o === "string" ? o === origin : o.test(origin)
      );
    }
    if (config.origin instanceof RegExp) {
      return config.origin.test(origin);
    }
    return false;
  };

  return async (ctx, next) => {
    const requestOrigin = ctx.req.headers.get("Origin");

    // 1. If no origin, strictly pass through
    if (!requestOrigin) {
      return next();
    }

    const headers = new Headers();
    headers.append("Vary", "Origin");

    // 2. Validate Origin
    if (!isOriginAllowed(requestOrigin)) {
      return next();
    }

    // 3. Set Allowed Origin and Credentials
    headers.set("Access-Control-Allow-Origin", requestOrigin);
    if (config.credentials) {
      headers.set("Access-Control-Allow-Credentials", "true");
    }

    // 4. Handle Preflight Requests (OPTIONS)
    if (ctx.req.method === "OPTIONS") {
      headers.set("Access-Control-Allow-Methods", config.methods);

      if (config.maxAge) {
        headers.set("Access-Control-Max-Age", config.maxAge.toString());
      }

      const requestedHeaders = ctx.req.headers.get(
        "Access-Control-Request-Headers"
      );
      if (requestedHeaders) {
        headers.set("Access-Control-Allow-Headers", requestedHeaders);
      } else if (config.allowedHeaders) {
        headers.set("Access-Control-Allow-Headers", config.allowedHeaders);
      }

      return new Response(null, { status: 204, headers });
    }

    // 5. Handle Exposed Headers for actual requests
    if (config.exposedHeaders) {
      headers.set("Access-Control-Expose-Headers", config.exposedHeaders);
    }

    // 6. Execute downstream middleware/handler
    const response = await next();

    // 7. Inject headers into the response
    if (response instanceof Response) {
      for (const [key, value] of headers.entries()) {
        response.headers.set(key, value);
      }
      return response;
    }

    // Fallback: If a passive middleware swallowed the response, check if the app context has a backup
    // (Relies on bklar v2 internal fix for void middlewares)
    if ((ctx as any)._res instanceof Response) {
      const res = (ctx as any)._res as Response;
      for (const [key, value] of headers.entries()) {
        res.headers.set(key, value);
      }
      return res;
    }

    return response;
  };
}
