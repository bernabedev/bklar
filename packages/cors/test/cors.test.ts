import { describe, expect, it } from "bun:test";
import { Bklar } from "bklar";
import { cors } from "../index";

describe("CORS Middleware", () => {
  it("should allow all origins by default", async () => {
    const app = Bklar({ logger: false });
    app.use(cors());
    app.get("/", (ctx) => ctx.text("ok"));

    const res = await app.request("/", {
      headers: { Origin: "https://example.com" },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://example.com"
    );
    expect(res.headers.get("Vary")).toBe("Origin");
  });

  it("should ignore requests without Origin header", async () => {
    const app = Bklar({ logger: false });
    app.use(cors());
    app.get("/", (ctx) => ctx.text("ok"));

    const res = await app.request("/");

    expect(res.status).toBe(200);
    expect(res.headers.has("Access-Control-Allow-Origin")).toBe(false);
  });

  it("should restrict to specific string origin", async () => {
    const app = Bklar({ logger: false });
    app.use(cors({ origin: "https://trusted.com" }));
    app.get("/", (ctx) => ctx.text("ok"));

    // Allowed Origin
    const res1 = await app.request("/", {
      headers: { Origin: "https://trusted.com" },
    });
    expect(res1.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://trusted.com"
    );

    // Blocked Origin (Headers should not be set)
    const res2 = await app.request("/", {
      headers: { Origin: "https://evil.com" },
    });
    expect(res2.headers.has("Access-Control-Allow-Origin")).toBe(false);
  });

  it("should support regex origins", async () => {
    const app = Bklar({ logger: false });
    // Allow any subdomain of example.com
    app.use(cors({ origin: /\.example\.com$/ }));
    app.get("/", (ctx) => ctx.text("ok"));

    const res = await app.request("/", {
      headers: { Origin: "https://api.example.com" },
    });

    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://api.example.com"
    );

    const resFail = await app.request("/", {
      headers: { Origin: "https://example.org" },
    });
    expect(resFail.headers.has("Access-Control-Allow-Origin")).toBe(false);
  });

  it("should support array of allowed origins", async () => {
    const app = Bklar({ logger: false });
    app.use(cors({ origin: ["https://a.com", "https://b.com"] }));
    app.get("/", (ctx) => ctx.text("ok"));

    const resA = await app.request("/", {
      headers: { Origin: "https://a.com" },
    });
    expect(resA.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://a.com"
    );

    const resC = await app.request("/", {
      headers: { Origin: "https://c.com" },
    });
    expect(resC.headers.has("Access-Control-Allow-Origin")).toBe(false);
  });

  it("should handle Preflight (OPTIONS) requests", async () => {
    const app = Bklar({ logger: false });
    app.use(
      cors({
        maxAge: 3600,
        allowedHeaders: ["X-Custom-Header"],
      })
    );

    const res = await app.request("/", {
      method: "OPTIONS",
      headers: {
        Origin: "https://example.com",
        "Access-Control-Request-Method": "POST",
      },
    });

    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://example.com"
    );
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("GET");
    expect(res.headers.get("Access-Control-Max-Age")).toBe("3600");
    expect(res.headers.get("Access-Control-Allow-Headers")).toContain(
      "X-Custom-Header"
    );
  });

  it("should reflect Access-Control-Request-Headers in Preflight", async () => {
    const app = Bklar({ logger: false });
    app.use(cors());

    const res = await app.request("/", {
      method: "OPTIONS",
      headers: {
        Origin: "https://example.com",
        "Access-Control-Request-Headers": "content-type, x-api-key",
      },
    });

    expect(res.headers.get("Access-Control-Allow-Headers")).toBe(
      "content-type, x-api-key"
    );
  });

  it("should set Access-Control-Allow-Credentials", async () => {
    const app = Bklar({ logger: false });
    app.use(cors({ credentials: true }));
    app.get("/", (ctx) => ctx.text("ok"));

    const res = await app.request("/", {
      headers: { Origin: "https://example.com" },
    });

    expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
  });

  it("should set Access-Control-Expose-Headers on actual requests", async () => {
    const app = Bklar({ logger: false });
    app.use(cors({ exposedHeaders: ["X-Total-Count"] }));
    app.get("/", (ctx) => ctx.text("ok"));

    const res = await app.request("/", {
      headers: { Origin: "https://example.com" },
    });

    expect(res.headers.get("Access-Control-Expose-Headers")).toBe(
      "X-Total-Count"
    );
  });

  it("should work correctly within a route group", async () => {
    const app = Bklar({ logger: false });

    // Global: No CORS
    app.get("/public", (ctx) => ctx.text("public"));

    // Group: With CORS
    app.group(
      "/api",
      (r) => {
        r.get("/private", (ctx) => ctx.text("private"));
      },
      [cors({ origin: "https://admin.com" })]
    );

    // Test Global
    const resPublic = await app.request("/public", {
      headers: { Origin: "https://admin.com" },
    });
    expect(resPublic.headers.has("Access-Control-Allow-Origin")).toBe(false);

    // Test Group
    const resPrivate = await app.request("/api/private", {
      headers: { Origin: "https://admin.com" },
    });
    expect(resPrivate.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://admin.com"
    );
  });
});
