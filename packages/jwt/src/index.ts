import type { Context, Middleware } from "bklar";
import { UnauthorizedError } from "bklar/errors";
import type { JWTPayload } from "jose";
import * as jose from "jose";

export * from "./helpers";

export interface JWTOptions {
  secret: string | Uint8Array;
  algorithms?: string[];
  getToken?: (ctx: Context<any>) => string | undefined;
  passthrough?: boolean;
}

declare module "bklar" {
  interface Context<T> {
    state: {
      jwt?: JWTPayload;
      [key: string]: any;
    };
  }
}

const defaultGetToken = (ctx: Context<any>): string | undefined => {
  const authHeader = ctx.req.headers.get("Authorization");
  if (authHeader) {
    const [type, token] = authHeader.split(" ");
    if (type === "Bearer" && token) {
      return token;
    }
  }
  return undefined;
};

export function jwt(options: JWTOptions): Middleware {
  const {
    secret,
    algorithms = ["HS256"],
    getToken = defaultGetToken,
    passthrough = false,
  } = options;

  if (!secret) {
    throw new Error("JWT secret is required for @bklarjs/jwt");
  }

  const secretKey =
    typeof secret === "string" ? new TextEncoder().encode(secret) : secret;

  const jwtMiddleware: Middleware = async (ctx: Context<any>) => {
    const token = getToken(ctx);

    if (!token) {
      if (passthrough) {
        return;
      }
      throw new UnauthorizedError("Missing authentication token");
    }

    try {
      const { payload } = await jose.jwtVerify(token, secretKey, {
        algorithms,
      });
      ctx.state.jwt = payload;
    } catch (err) {
      if (passthrough) {
        return;
      }
      if (err instanceof jose.errors.JWTExpired) {
        throw new UnauthorizedError("Token has expired");
      }
      if (err instanceof jose.errors.JOSEError) {
        throw new UnauthorizedError("Invalid token");
      }
      throw err;
    }
  };

  return jwtMiddleware;
}
