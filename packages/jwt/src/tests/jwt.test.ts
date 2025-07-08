import { Bklar as createApp } from "bklar";
import { UnauthorizedError } from "bklar/errors";
import { beforeEach, describe, expect, it } from "bun:test";
import * as jose from "jose";
import { jwt as createJwt, decode, sign, verify } from "../index";

const JWT_SECRET = "my-super-secret-key-for-testing";

describe("@bklarjs/jwt Package Tests", () => {
  // --- PARTE 1: Tests para los Helpers ---
  describe("Helper Functions (sign, verify, decode)", () => {
    const payload = { sub: "123", email: "test@example.com" };

    it("should sign a payload and verify it successfully", async () => {
      const token = await sign(payload, JWT_SECRET);
      expect(typeof token).toBe("string");

      const verifiedPayload = await verify(token, JWT_SECRET);
      expect(verifiedPayload.sub).toBe(payload.sub);
      expect(verifiedPayload.email).toBe(payload.email);
    });

    it("should throw an error when verifying with a wrong secret", async () => {
      const token = await sign(payload, JWT_SECRET);
      const wrongSecret = "a-different-secret";

      await expect(verify(token, wrongSecret)).rejects.toThrow(
        jose.errors.JWSSignatureVerificationFailed
      );
    });

    it("should throw an error for an expired token", async () => {
      const token = await sign(payload, JWT_SECRET, "HS256", {
        expiresIn: "-1s",
      });

      await expect(verify(token, JWT_SECRET)).rejects.toThrow(
        jose.errors.JWTExpired
      );
    });

    it("should decode a token without verification", () => {
      const token =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjMifQ.R5h1pB-yPldxGMLi2irgJ2QGVer2tAUn0zSA1a5aLwE"; // A valid-looking but unverified token
      const decoded = decode(token);
      expect(decoded.sub).toBe("123");
    });
  });

  // --- PARTE 2: Tests para el Middleware ---
  describe("JWT Middleware Integration", () => {
    let app: ReturnType<typeof createApp>;
    const payload = { sub: "user-1", role: "admin" };

    beforeEach(() => {
      app = createApp({
        // Deshabilitamos el logger en los tests para una salida limpia
        logger: false,
        // Usamos un errorHandler simple para verificar los errores
        errorHandler: (error) => {
          if (error instanceof UnauthorizedError) {
            return new Response(JSON.stringify({ message: error.message }), {
              status: 401,
            });
          }
          return new Response("Internal Server Error", { status: 500 });
        },
      });
    });

    it("should protect a route and populate ctx.state.jwt with a valid token", async () => {
      const authMiddleware = createJwt({ secret: JWT_SECRET });
      app.get("/profile", (ctx) => ctx.json({ user: ctx.state.jwt }), {
        middlewares: [authMiddleware],
      });

      const token = await sign(payload, JWT_SECRET);
      const req = new Request("http://localhost/profile", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const res = await app.router.handle(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.user.sub).toBe(payload.sub);
      expect(body.user.role).toBe(payload.role);
    });

    it("should throw UnauthorizedError if no token is provided", async () => {
      const authMiddleware = createJwt({ secret: JWT_SECRET });
      app.get("/protected", (ctx) => ctx.json({ ok: true }), {
        middlewares: [authMiddleware],
      });

      const req = new Request("http://localhost/protected");
      const res = await app.router.handle(req);
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.message).toBe("Missing authentication token");
    });

    it("should throw UnauthorizedError for an invalid token", async () => {
      const authMiddleware = createJwt({ secret: JWT_SECRET });
      app.get("/protected", (ctx) => ctx.json({ ok: true }), {
        middlewares: [authMiddleware],
      });

      const invalidToken = "not-a-real-token";
      const req = new Request("http://localhost/protected", {
        headers: { Authorization: `Bearer ${invalidToken}` },
      });

      const res = await app.router.handle(req);
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.message).toBe("Invalid token");
    });

    it("should throw UnauthorizedError for an expired token", async () => {
      const authMiddleware = createJwt({ secret: JWT_SECRET });
      app.get("/protected", (ctx) => ctx.json({ ok: true }), {
        middlewares: [authMiddleware],
      });

      const expiredToken = await sign(payload, JWT_SECRET, "HS256", {
        expiresIn: "-1s",
      });
      const req = new Request("http://localhost/protected", {
        headers: { Authorization: `Bearer ${expiredToken}` },
      });

      const res = await app.router.handle(req);
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.message).toBe("Token has expired");
    });

    describe("Passthrough Mode", () => {
      it("should allow request to continue if token is missing", async () => {
        const authMiddleware = createJwt({
          secret: JWT_SECRET,
          passthrough: true,
        });
        app.get(
          "/optional-auth",
          (ctx) => {
            return ctx.json({ user: ctx.state.jwt || null });
          },
          { middlewares: [authMiddleware] }
        );

        const req = new Request("http://localhost/optional-auth");
        const res = await app.router.handle(req);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.user).toBeNull();
      });

      it("should allow request to continue if token is invalid", async () => {
        const authMiddleware = createJwt({
          secret: JWT_SECRET,
          passthrough: true,
        });
        app.get(
          "/optional-auth",
          (ctx) => {
            return ctx.json({ user: ctx.state.jwt || null });
          },
          { middlewares: [authMiddleware] }
        );

        const req = new Request("http://localhost/optional-auth", {
          headers: { Authorization: "Bearer an-invalid-token" },
        });

        const res = await app.router.handle(req);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.user).toBeNull();
      });

      it("should populate ctx.state.jwt if a valid token is provided in passthrough mode", async () => {
        const authMiddleware = createJwt({
          secret: JWT_SECRET,
          passthrough: true,
        });
        app.get(
          "/optional-auth",
          (ctx) => {
            return ctx.json({ user: ctx.state.jwt || null });
          },
          { middlewares: [authMiddleware] }
        );

        const token = await sign(payload, JWT_SECRET);
        const req = new Request("http://localhost/optional-auth", {
          headers: { Authorization: `Bearer ${token}` },
        });

        const res = await app.router.handle(req);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.user.sub).toBe(payload.sub);
      });
    });
  });
});
