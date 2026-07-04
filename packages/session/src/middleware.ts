import type { Middleware } from "bklar";
import type { SessionData, SessionOptions } from "./types";
import { MemoryStore } from "./memory-store";

function generateSessionId(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function session(options: SessionOptions = {}): Middleware {
  const store = options.store || new MemoryStore();
  const cookieName = options.cookieName || "sid";
  const maxAge = options.maxAge ?? 86400000;
  const httpOnly = options.httpOnly ?? true;
  const secure = options.secure ?? false;
  const sameSite = options.sameSite ?? "Lax";
  const path = options.path ?? "/";

  return async (ctx, next) => {
    const sid = ctx.getCookie(cookieName);
    let sessionData: SessionData;

    if (sid) {
      const stored = await store.get(sid);
      if (stored) {
        sessionData = stored;
        ctx.state.sessionId = sid;
      } else {
        const newSid = generateSessionId();
        sessionData = {};
        ctx.setCookie(cookieName, newSid, {
          maxAge,
          httpOnly,
          secure,
          sameSite,
          path,
        });
        ctx.state.sessionId = newSid;
        await store.set(newSid, sessionData, maxAge);
      }
    } else {
      const newSid = generateSessionId();
      sessionData = {};
      ctx.setCookie(cookieName, newSid, {
        maxAge,
        httpOnly,
        secure,
        sameSite,
        path,
      });
      ctx.state.sessionId = newSid;
      await store.set(newSid, sessionData, maxAge);
    }

    ctx.state.session = sessionData;

    await next();

    if (ctx.state.sessionId && ctx.state.session) {
      await store.set(ctx.state.sessionId, ctx.state.session, maxAge);
    }
  };
}
