import { describe, it, expect, mock } from "bun:test";
import { Bklar, type Context } from "bklar";
import { jwt, sign, verify, decode } from "../src"; // Adjust path if necessary
import { UnauthorizedError, HttpError } from "bklar/errors";

const TEST_SECRET = "your-test-secret";
const TEST_SECRET_UINT8ARRAY = new TextEncoder().encode(TEST_SECRET);

// Mock context utility
const createMockContext = (headers: Record<string, string> = {}): Context => {
  const req = new Request("http://localhost/", { headers });
  // A simplified mock of what Bklar's context might look like for testing
  return {
    req,
    params: {},
    query: {},
    state: {},
    json: (data: any, status: number = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }),
    html: (data: string, status: number = 200) => new Response(data, { status, headers: { 'Content-Type': 'text/html' } }),
    text: (data: string, status: number = 200) => new Response(data, { status, headers: { 'Content-Type': 'text/plain' } }),
    // Add other context methods if your middleware uses them
  } as unknown as Context;
};


describe("@bklar/jwt", () => {
  describe("Helpers", () => {
    const payload = { userId: 1, username: "testuser" };

    it("sign and verify a token with string secret", async () => {
      const token = await sign(payload, TEST_SECRET, "HS256", { expiresIn: "1h" });
      expect(token).toBeString();

      const decodedPayload = await verify(token, TEST_SECRET, ["HS256"]);
      expect(decodedPayload.userId).toBe(payload.userId);
      expect(decodedPayload.username).toBe(payload.username);
      expect(decodedPayload.exp).toBeNumber();
    });

    it("sign and verify a token with Uint8Array secret", async () => {
      const token = await sign(payload, TEST_SECRET_UINT8ARRAY, "HS256", { expiresIn: "1h" });
      expect(token).toBeString();

      const decodedPayload = await verify(token, TEST_SECRET_UINT8ARRAY, ["HS256"]);
      expect(decodedPayload.userId).toBe(payload.userId);
      expect(decodedPayload.username).toBe(payload.username);
    });

    it("verify should throw for an invalid token", async () => {
      const invalidToken = "invalid.token.string";
      await expect(verify(invalidToken, TEST_SECRET)).rejects.toThrow();
    });

    it("verify should throw for an expired token", async () => {
      const token = await sign(payload, TEST_SECRET, "HS256", { expiresIn: "0s" });
      // Wait for a moment to ensure token is expired
      await new Promise(resolve => setTimeout(resolve, 50));
      await expect(verify(token, TEST_SECRET)).rejects.toThrow("Token has expired");
    });

    it("decode a token without verification", async () => {
      const token = await sign(payload, TEST_SECRET);
      const decoded = decode(token);
      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.username).toBe(payload.username);
    });
  });

  describe("JWT Middleware", () => {
    const app = Bklar();
    const secret = "test-middleware-secret";
    const jwtMiddleware = jwt({ secret });

    const protectedHandler = mock(async (ctx: Context) => {
      return ctx.json({ user: ctx.state.user, message: "Protected data" });
    });

    const passthroughHandler = mock(async (ctx: Context) => {
      return ctx.json({ user: ctx.state.user, message: "Passthrough data" });
    });

    app.post("/protected", protectedHandler, { middlewares: [jwtMiddleware] });
    app.post("/passthrough", passthroughHandler, { middlewares: [jwt({ secret, passthrough: true })] });


    it("should allow access with a valid token", async () => {
      const token = await sign({ userId: "user123" }, secret);
      const req = new Request("http://localhost/protected", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const res = await app.fetch(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.user.userId).toBe("user123");
      expect(body.message).toBe("Protected data");
      expect(protectedHandler).toHaveBeenCalled();
    });

    it("should return UnauthorizedError for missing token", async () => {
      const req = new Request("http://localhost/protected", { method: "POST" });
      const res = await app.fetch(req);
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error.message).toBe("Missing authentication token");
    });

    it("should return UnauthorizedError for invalid token", async () => {
      const req = new Request("http://localhost/protected", {
        method: "POST",
        headers: { Authorization: "Bearer invalidtoken" },
      });
      const res = await app.fetch(req);
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error.message).toBe("Invalid token");
    });

    it("should return UnauthorizedError for expired token", async () => {
      const token = await sign({ userId: "user123" }, secret, "HS256", { expiresIn: "0s" });
       await new Promise(resolve => setTimeout(resolve, 50)); // Ensure token is expired
      const req = new Request("http://localhost/protected", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const res = await app.fetch(req);
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error.message).toBe("Token has expired");
    });

    it("should use custom getToken function if provided", async () => {
        const customJwtMiddleware = jwt({
            secret,
            getToken: (ctx) => ctx.req.headers.get("X-Custom-Auth") || undefined,
        });
        const customApp = Bklar();
        const customProtectedHandler = mock(async (ctx: Context) => ctx.json({ user: ctx.state.user }));
        customApp.post("/custom-token", customProtectedHandler, { middlewares: [customJwtMiddleware] });

        const token = await sign({ userId: "customUser" }, secret);
        const req = new Request("http://localhost/custom-token", {
            method: "POST",
            headers: { "X-Custom-Auth": token },
        });
        const res = await customApp.fetch(req);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.user.userId).toBe("customUser");
    });

    it("passthrough: should allow request if token is missing", async () => {
      const req = new Request("http://localhost/passthrough", { method: "POST" });
      const res = await app.fetch(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.user).toBeUndefined();
      expect(body.message).toBe("Passthrough data");
      expect(passthroughHandler).toHaveBeenCalled();
    });

    it("passthrough: should allow request if token is invalid", async () => {
      const req = new Request("http://localhost/passthrough", {
        method: "POST",
        headers: { Authorization: "Bearer invalidtoken" },
      });
      const res = await app.fetch(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.user).toBeUndefined();
      expect(body.message).toBe("Passthrough data");
    });

    it("passthrough: should set ctx.state.user if token is valid", async () => {
      const token = await sign({ userId: "passthroughUser" }, secret);
      const req = new Request("http://localhost/passthrough", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const res = await app.fetch(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.user.userId).toBe("passthroughUser");
      expect(body.message).toBe("Passthrough data");
    });

    it("should throw an error if secret is not provided", () => {
      expect(() => jwt({ secret: "" } as any)).toThrow("JWT secret is required");
    });
  });
});
