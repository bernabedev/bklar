import type { SessionData, SessionStore } from "./types";

export class MemoryStore implements SessionStore {
  private store: Map<string, { data: SessionData; expiresAt: number }> =
    new Map();
  private cleanupInterval: Timer;

  constructor() {
    this.cleanupInterval = setInterval(() => this._cleanup(), 60000);
    if (
      typeof this.cleanupInterval === "object" &&
      "unref" in this.cleanupInterval
    ) {
      (this.cleanupInterval as any).unref();
    }
  }

  get(sid: string): SessionData | null {
    const entry = this.store.get(sid);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(sid);
      return null;
    }
    return entry.data;
  }

  set(sid: string, data: SessionData, maxAge: number = 86400000): void {
    this.store.set(sid, {
      data,
      expiresAt: Date.now() + maxAge,
    });
  }

  destroy(sid: string): void {
    this.store.delete(sid);
  }

  clear(): void {
    this.store.clear();
  }

  private _cleanup(): void {
    const now = Date.now();
    for (const [sid, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(sid);
      }
    }
  }
}
