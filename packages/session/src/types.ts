export interface SessionData {
  [key: string]: any;
}

export interface SessionStore {
  get(sid: string): Promise<SessionData | null> | SessionData | null;
  set(sid: string, data: SessionData, maxAge?: number): Promise<void> | void;
  destroy(sid: string): Promise<void> | void;
}

export interface SessionOptions {
  store?: SessionStore;
  secret?: string;
  cookieName?: string;
  maxAge?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Strict" | "Lax" | "None";
  path?: string;
}

declare module "bklar" {
  interface State {
    session?: SessionData;
    sessionId?: string;
  }
}
