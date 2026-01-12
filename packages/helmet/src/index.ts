import type { Middleware } from "bklar";

export interface HelmetOptions {
  /**
   * Content-Security-Policy settings.
   * @default undefined (disabled by default to prevent breakage)
   */
  contentSecurityPolicy?:
    | {
        directives: Record<string, string | string[]>;
        reportOnly?: boolean;
      }
    | boolean;

  /**
   * X-Content-Type-Options settings.
   * @default true ("nosniff")
   */
  xContentTypeOptions?: boolean;

  /**
   * X-DNS-Prefetch-Control settings.
   * @default true ("off")
   */
  xDnsPrefetchControl?: { allow?: boolean } | boolean;

  /**
   * X-Download-Options settings.
   * @default true ("noopen")
   */
  xDownloadOptions?: boolean;

  /**
   * X-Frame-Options settings.
   * @default "SAMEORIGIN"
   */
  xFrameOptions?: "DENY" | "SAMEORIGIN" | false;

  /**
   * X-Permitted-Cross-Domain-Policies settings.
   * @default "none"
   */
  xPermittedCrossDomainPolicies?:
    | "none"
    | "master-only"
    | "by-content-type"
    | "all"
    | false;

  /**
   * Strict-Transport-Security settings.
   * @default { maxAge: 15552000, includeSubDomains: true }
   */
  strictTransportSecurity?:
    | {
        maxAge?: number;
        includeSubDomains?: boolean;
        preload?: boolean;
      }
    | boolean;

  /**
   * X-XSS-Protection settings.
   * @default "0" (disable browser audit, modern standard)
   */
  xXssProtection?: "0" | "1" | "1; mode=block" | false;

  /**
   * Referrer-Policy settings.
   * @default "no-referrer"
   */
  referrerPolicy?:
    | "no-referrer"
    | "no-referrer-when-downgrade"
    | "origin"
    | "origin-when-cross-origin"
    | "same-origin"
    | "strict-origin"
    | "strict-origin-when-cross-origin"
    | "unsafe-url"
    | false;

  /**
   * Cross-Origin-Opener-Policy settings.
   * @default "same-origin"
   */
  crossOriginOpenerPolicy?:
    | "same-origin"
    | "same-origin-allow-popups"
    | "unsafe-none"
    | false;

  /**
   * Cross-Origin-Resource-Policy settings.
   * @default "same-origin"
   */
  crossOriginResourcePolicy?:
    | "same-origin"
    | "same-site"
    | "cross-origin"
    | false;

  /**
   * Origin-Agent-Cluster settings.
   * @default "?1"
   */
  originAgentCluster?: boolean;
}

const DEFAULT_OPTIONS: HelmetOptions = {
  xContentTypeOptions: true,
  xDnsPrefetchControl: true,
  xDownloadOptions: true,
  xFrameOptions: "SAMEORIGIN",
  xPermittedCrossDomainPolicies: "none",
  strictTransportSecurity: {
    maxAge: 15552000, // 180 days
    includeSubDomains: true,
  },
  xXssProtection: "0",
  referrerPolicy: "no-referrer",
  crossOriginOpenerPolicy: "same-origin",
  crossOriginResourcePolicy: "same-origin",
  originAgentCluster: true,
  // CSP is disabled by default in this implementation to avoid breaking apps immediately,
  // but users can enable it easily.
  contentSecurityPolicy: false,
};

export function helmet(options: HelmetOptions = {}): Middleware {
  const config = { ...DEFAULT_OPTIONS, ...options };

  return async (ctx, next) => {
    // 1. Execute downstream middleware
    const res = await next();

    // 2. Resolve the response object (handling v2 middleware pattern)
    const response =
      res instanceof Response
        ? res
        : (ctx as any)._res instanceof Response
        ? (ctx as any)._res
        : null;

    if (!response) return res;

    const headers = response.headers;

    // --- Apply Headers ---

    // 1. Content-Security-Policy
    if (
      config.contentSecurityPolicy &&
      typeof config.contentSecurityPolicy === "object"
    ) {
      const { directives, reportOnly } = config.contentSecurityPolicy;
      const headerName = reportOnly
        ? "Content-Security-Policy-Report-Only"
        : "Content-Security-Policy";

      const policy = Object.entries(directives)
        .map(([key, value]) => {
          // specific dash-case conversion for common keys could go here if we wanted strictly typed directives
          // but relying on user string keys is more flexible for new specs.
          const formattedKey = key.replace(
            /[A-Z]/g,
            (m) => "-" + m.toLowerCase()
          );
          const val = Array.isArray(value) ? value.join(" ") : value;
          return `${formattedKey} ${val}`;
        })
        .join("; ");

      if (policy) headers.set(headerName, policy);
    }

    // 2. Cross-Origin-Opener-Policy
    if (config.crossOriginOpenerPolicy) {
      headers.set("Cross-Origin-Opener-Policy", config.crossOriginOpenerPolicy);
    }

    // 3. Cross-Origin-Resource-Policy
    if (config.crossOriginResourcePolicy) {
      headers.set(
        "Cross-Origin-Resource-Policy",
        config.crossOriginResourcePolicy
      );
    }

    // 4. Origin-Agent-Cluster
    if (config.originAgentCluster) {
      headers.set("Origin-Agent-Cluster", "?1");
    }

    // 5. Referrer-Policy
    if (config.referrerPolicy) {
      headers.set("Referrer-Policy", config.referrerPolicy);
    }

    // 6. Strict-Transport-Security
    if (config.strictTransportSecurity) {
      let hsts = "max-age=";
      if (typeof config.strictTransportSecurity === "object") {
        hsts += config.strictTransportSecurity.maxAge ?? 15552000;
        if (config.strictTransportSecurity.includeSubDomains)
          hsts += "; includeSubDomains";
        if (config.strictTransportSecurity.preload) hsts += "; preload";
      } else {
        hsts += "15552000; includeSubDomains";
      }
      headers.set("Strict-Transport-Security", hsts);
    }

    // 7. X-Content-Type-Options
    if (config.xContentTypeOptions) {
      headers.set("X-Content-Type-Options", "nosniff");
    }

    // 8. X-DNS-Prefetch-Control
    if (config.xDnsPrefetchControl) {
      const allow =
        typeof config.xDnsPrefetchControl === "object" &&
        config.xDnsPrefetchControl.allow;
      headers.set("X-DNS-Prefetch-Control", allow ? "on" : "off");
    }

    // 9. X-Download-Options
    if (config.xDownloadOptions) {
      headers.set("X-Download-Options", "noopen");
    }

    // 10. X-Frame-Options
    if (config.xFrameOptions) {
      headers.set("X-Frame-Options", config.xFrameOptions);
    }

    // 11. X-Permitted-Cross-Domain-Policies
    if (config.xPermittedCrossDomainPolicies) {
      headers.set(
        "X-Permitted-Cross-Domain-Policies",
        config.xPermittedCrossDomainPolicies
      );
    }

    // 12. X-XSS-Protection
    if (config.xXssProtection) {
      headers.set("X-XSS-Protection", config.xXssProtection);
    }

    return response;
  };
}
