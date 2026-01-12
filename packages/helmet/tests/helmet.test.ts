import { describe, expect, it } from "bun:test";
import { Bklar } from "bklar";
import { helmet } from "../src/index";

describe("Helmet Middleware", () => {
  it("should set default security headers", async () => {
    const app = Bklar({ logger: false });
    app.use(helmet());
    app.get("/", (ctx) => ctx.text("ok"));

    const res = await app.request("/");

    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
    expect(res.headers.get("Strict-Transport-Security")).toContain(
      "max-age=15552000"
    );
    expect(res.headers.get("X-XSS-Protection")).toBe("0");
    expect(res.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(res.headers.has("Content-Security-Policy")).toBe(false); // Disabled by default
  });

  it("should allow disabling specific headers", async () => {
    const app = Bklar({ logger: false });
    app.use(
      helmet({
        xFrameOptions: false,
        xXssProtection: false,
      })
    );
    app.get("/", (ctx) => ctx.text("ok"));

    const res = await app.request("/");

    expect(res.headers.has("X-Frame-Options")).toBe(false);
    expect(res.headers.has("X-XSS-Protection")).toBe(false);
    // Others should still be there
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("should configure HSTS correctly", async () => {
    const app = Bklar({ logger: false });
    app.use(
      helmet({
        strictTransportSecurity: {
          maxAge: 3600,
          includeSubDomains: false,
          preload: true,
        },
      })
    );
    app.get("/", (ctx) => ctx.text("ok"));

    const res = await app.request("/");
    const hsts = res.headers.get("Strict-Transport-Security");

    expect(hsts).toContain("max-age=3600");
    expect(hsts).toContain("preload");
    expect(hsts).not.toContain("includeSubDomains");
  });

  it("should configure CSP when enabled", async () => {
    const app = Bklar({ logger: false });
    app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "https://apis.google.com"],
            upgradeInsecureRequests: [],
          },
        },
      })
    );
    app.get("/", (ctx) => ctx.text("ok"));

    const res = await app.request("/");
    const csp = res.headers.get("Content-Security-Policy");

    expect(csp).toBeDefined();
    // Check conversions (camelCase to kebab-case)
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self' https://apis.google.com");
    expect(csp).toContain("upgrade-insecure-requests");
  });

  it("should support CSP Report Only mode", async () => {
    const app = Bklar({ logger: false });
    app.use(
      helmet({
        contentSecurityPolicy: {
          reportOnly: true,
          directives: { defaultSrc: ["'self'"] },
        },
      })
    );
    app.get("/", (ctx) => ctx.text("ok"));

    const res = await app.request("/");

    expect(res.headers.has("Content-Security-Policy")).toBe(false);
    expect(res.headers.has("Content-Security-Policy-Report-Only")).toBe(true);
  });

  it("should set Cross-Origin policies correctly", async () => {
    const app = Bklar({ logger: false });
    app.use(
      helmet({
        crossOriginOpenerPolicy: "same-origin-allow-popups",
        crossOriginResourcePolicy: "cross-origin",
      })
    );
    app.get("/", (ctx) => ctx.text("ok"));

    const res = await app.request("/");

    expect(res.headers.get("Cross-Origin-Opener-Policy")).toBe(
      "same-origin-allow-popups"
    );
    expect(res.headers.get("Cross-Origin-Resource-Policy")).toBe(
      "cross-origin"
    );
  });
});
