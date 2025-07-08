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

  return async (ctx) => {
    const requestOrigin = ctx.req.headers.get("Origin");

    if (!requestOrigin) {
      return;
    }

    const headers = new Headers();
    let isAllowed = false;

    if (isOriginAllowed(requestOrigin)) {
      isAllowed = true;
      headers.set("Access-Control-Allow-Origin", requestOrigin);
      if (config.credentials) {
        headers.set("Access-Control-Allow-Credentials", "true");
      }
    }

    headers.append("Vary", "Origin");

    if (ctx.req.method === "OPTIONS") {
      if (!isAllowed) {
        return new Response(null, { status: 204 });
      }

      headers.set("Access-Control-Allow-Methods", config.methods);

      const requestedHeaders = ctx.req.headers.get(
        "Access-Control-Request-Headers"
      );
      if (requestedHeaders) {
        headers.set("Access-Control-Allow-Headers", requestedHeaders);
      } else if (config.allowedHeaders) {
        headers.set("Access-Control-Allow-Headers", config.allowedHeaders);
      }

      if (config.maxAge) {
        headers.set("Access-Control-Max-Age", config.maxAge.toString());
      }

      return new Response(null, { status: 204, headers });
    }

    if (isAllowed) {
      if (config.exposedHeaders) {
        headers.set("Access-Control-Expose-Headers", config.exposedHeaders);
      }
      ctx.state.corsHeaders = headers;
    }
  };
}
