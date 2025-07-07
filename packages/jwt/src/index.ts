import type { Middleware, Context } from "bklar";
import { UnauthorizedError } from "bklar/errors";
import * as jose from "jose";

export interface JWTOptions {
  secret: string | Uint8Array;
  algorithms?: string[];
  getToken?: (ctx: Context) => string | undefined;
  passthrough?: boolean; // If true, allows request to continue even if token is invalid/missing
}

export interface JWTState {
  user?: any; // Define a more specific type for your user payload
}

declare module "bklar" {
  interface State extends JWTState {}
}

const defaultGetToken = (ctx: Context): string | undefined => {
  const authHeader = ctx.req.headers.get("Authorization");
  if (authHeader) {
    const [type, token] = authHeader.split(" ");
    if (type === "Bearer" && token) {
      return token;
    }
  }
  return undefined;
};

export const jwt = (options: JWTOptions): Middleware => {
  const {
    secret,
    algorithms = ["HS256"],
    getToken = defaultGetToken,
    passthrough = false,
  } = options;

  if (!secret) {
    throw new Error("JWT secret is required");
  }

  const secretKey = typeof secret === 'string' ? new TextEncoder().encode(secret) : secret;

  return async (ctx, next) => {
    const token = getToken(ctx);

    if (!token) {
      if (passthrough) {
        return next();
      }
      throw new UnauthorizedError("Missing authentication token");
    }

    try {
      const { payload } = await jose.jwtVerify(token, secretKey, {
        algorithms,
      });
      ctx.state.user = payload;
    } catch (err) {
      if (passthrough) {
        return next();
      }
      if (err instanceof jose.errors.JWTExpired) {
        throw new UnauthorizedError("Token has expired");
      }
      if (err instanceof jose.errors.JOSEError) { // Catch other jose errors
        throw new UnauthorizedError("Invalid token");
      }
      // For unexpected errors, rethrow
      throw err;
    }

    await next();
  };
};

export default jwt;
