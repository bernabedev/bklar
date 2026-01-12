import type { InferContext, Middleware } from "bklar";
import { UnauthorizedError } from "bklar/errors";
import type { JWTPayload } from "jose";
import { errors, jwtVerify } from "jose";

export * from "./helpers";

export interface JWTOptions {
  secret: string | Uint8Array;
  algorithms?: string[];
  getToken?: (ctx: InferContext<any>) => string | undefined;
  passthrough?: boolean;
}

declare module "bklar" {
  interface State {
    jwt?: JWTPayload;
  }
}

const defaultGetToken = (ctx: InferContext<any>): string | undefined => {
  const authHeader = ctx.req.headers.get("Authorization");
  if (authHeader) {
    const [type, token] = authHeader.split(" ");
    if (type === "Bearer" && token) {
      return token;
    }
  }
  return undefined;
};

export function jwt<T extends JWTPayload = JWTPayload>(
  options: JWTOptions
): Middleware {
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

  const jwtMiddleware: Middleware = async (ctx, next) => {
    const token = getToken(ctx);

    if (!token) {
      if (!passthrough) {
        throw new UnauthorizedError("Missing authentication token");
      }
      return next();
    }

    try {
      const { payload } = await jwtVerify(token, secretKey, {
        algorithms,
      });
      ctx.state.jwt = payload as T;
    } catch (err) {
      if (!passthrough) {
        if (err instanceof errors.JWTExpired) {
          throw new UnauthorizedError("Token has expired");
        }
        if (err instanceof errors.JOSEError) {
          throw new UnauthorizedError("Invalid token");
        }
        throw err;
      }
      // If passthrough is enabled and verification fails, just continue.
      // ctx.state.jwt will remain undefined.
    }

    // Explicitly await the next middleware to ensure the chain resolves correctly
    // and returns the Response object from the handler.
    const res = await next();
    return res;
  };

  return jwtMiddleware;
}
