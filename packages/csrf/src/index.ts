import type { Middleware } from "bklar";

export interface CsrfOptions {
  cookieName?: string;
  headerName?: string;
  fieldName?: string;
  secret?: Uint8Array;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Strict" | "Lax" | "None";
}

declare module "bklar" {
  interface State {
    csrfToken?: string;
  }
}

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function csrf(options: CsrfOptions = {}): Middleware {
  const cookieName = options.cookieName || "csrf-token";
  const headerName = (options.headerName || "x-csrf-token").toLowerCase();
  const fieldName = options.fieldName || "_csrf";
  const httpOnly = options.httpOnly ?? false;
  const secure = options.secure ?? false;
  const sameSite = options.sameSite ?? "Strict";
  const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

  return async (ctx, next) => {
    let cookieToken = ctx.getCookie(cookieName);

    if (!cookieToken) {
      cookieToken = generateToken();
      ctx.setCookie(cookieName, cookieToken, {
        httpOnly,
        secure,
        sameSite,
        path: "/",
      });
    }

    ctx.state.csrfToken = cookieToken;

    if (safeMethods.has(ctx.req.method)) {
      return next();
    }

    // Validate mutating requests
    const headerToken = ctx.req.headers.get(headerName);
    let bodyToken: string | undefined;

    if (ctx.req.headers.get("content-type")?.includes("application/x-www-form-urlencoded")) {
      const clone = ctx.req.clone();
      const formData = await clone.formData();
      bodyToken = formData.get(fieldName) as string | undefined;
    } else if (ctx.req.headers.get("content-type")?.includes("application/json")) {
      const clone = ctx.req.clone();
      const body = await clone.json();
      bodyToken = body?.[fieldName];
    }

    const requestToken = headerToken || bodyToken;

    if (!requestToken || requestToken !== cookieToken) {
      return new Response(JSON.stringify({
        error: "Forbidden",
        message: "Invalid CSRF token",
        statusCode: 403,
      }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    return next();
  };
}
