import type { HeadersInit, BunFile } from "bun";
import {
  State,
  type ServerTimingEntry,
  type SSEWriter,
  type CacheControlDirectives,
} from "./types";

export interface CookieOptions {
  domain?: string;
  expires?: Date;
  httpOnly?: boolean;
  maxAge?: number;
  path?: string;
  secure?: boolean;
  sameSite?: "Strict" | "Lax" | "None";
}

export class Context<T extends { query: any; params: any; body: any }> {
  public readonly req: Request;
  public state: State = {};
  public params: T["params"];
  public query: T["query"] = {} as T["query"];
  public body: T["body"] = {} as T["body"];
  private bodyParsed = false;
  // Store persistent headers to be merged into the response
  public _headers: Headers = new Headers();
  // Store cookies to be set in the response
  public _setCookies: string[] = [];
  public signal: AbortSignal;
  public requestId: string;
  private _requestIdHeaderName: string;
  private _maxBodySize: number;
  private _serverTimings: ServerTimingEntry[] = [];
  public _errorFormat: "basic" | "problemJson" = "basic";

  constructor(
    req: Request,
    params: T["params"],
    signal?: AbortSignal,
    requestId?: string,
    maxBodySize?: number,
    requestIdHeaderName?: string,
  ) {
    this.req = req;
    this.params = params;
    this.signal = signal ?? req.signal;
    this.requestId = requestId ?? crypto.randomUUID();
    this._maxBodySize = maxBodySize ?? 0;
    this._requestIdHeaderName = requestIdHeaderName ?? "X-Request-Id";
  }

  setHeader(key: string, value: string) {
    this._headers.set(key, value);
  }

  async parseBody() {
    if (
      this.bodyParsed ||
      this.req.method === "GET" ||
      this.req.method === "HEAD"
    ) {
      return;
    }
    try {
      const contentLength = this.req.headers.get("content-length");
      if (
        this._maxBodySize > 0 &&
        contentLength &&
        parseInt(contentLength, 10) > this._maxBodySize
      ) {
        throw Object.assign(new Error("Payload Too Large"), { status: 413 });
      }

      const contentType = this.req.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        if (this._maxBodySize > 0 && this.req.body) {
          this.body = await this._readLimitedBody(this.req);
        } else {
          this.body = await this.req.json();
        }
      } else if (contentType?.includes("application/x-www-form-urlencoded")) {
        const formData = await this.req.formData();
        this.body = Object.fromEntries(formData.entries()) as T["body"];
      }
    } catch (error: any) {
      if (error?.status === 413) throw error;
      // Ignore body parsing errors, validation will catch empty body if required
    } finally {
      this.bodyParsed = true;
    }
  }

  private async _readLimitedBody(req: Request): Promise<any> {
    const reader = req.body!.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > this._maxBodySize) {
        reader.cancel();
        throw Object.assign(new Error("Payload Too Large"), { status: 413 });
      }
      chunks.push(value);
    }

    const buffer = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      buffer.set(chunk, offset);
      offset += chunk.length;
    }
    const text = new TextDecoder().decode(buffer);
    return JSON.parse(text);
  }

  json(
    data: object,
    status: number = 200,
    headers: HeadersInit = {},
  ): Response {
    const responseHeaders = new Headers(headers);
    responseHeaders.set("Content-Type", "application/json");
    this._mergeHeaders(responseHeaders);
    this._appendCookies(responseHeaders);
    this._appendRequestId(responseHeaders);
    this._appendServerTiming(responseHeaders);
    return new Response(JSON.stringify(data), {
      status,
      headers: responseHeaders,
    });
  }

  text(
    data: string,
    status: number = 200,
    headers: HeadersInit = {},
  ): Response {
    const responseHeaders = new Headers(headers);
    responseHeaders.set("Content-Type", "text/plain;charset=UTF-8");
    this._mergeHeaders(responseHeaders);
    this._appendCookies(responseHeaders);
    this._appendRequestId(responseHeaders);
    this._appendServerTiming(responseHeaders);
    return new Response(data, {
      status,
      headers: responseHeaders,
    });
  }

  download(
    file: Blob | BunFile,
    filename?: string,
    headers: HeadersInit = {},
  ): Response {
    const responseHeaders = new Headers(headers);

    if (file.type) {
      responseHeaders.set("Content-Type", file.type);
    } else {
      responseHeaders.set("Content-Type", "application/octet-stream");
    }

    if (filename) {
      responseHeaders.set(
        "Content-Disposition",
        `attachment; filename="${filename}"`,
      );
    }

    this._mergeHeaders(responseHeaders);
    this._appendCookies(responseHeaders);
    this._appendRequestId(responseHeaders);
    this._appendServerTiming(responseHeaders);

    return new Response(file, {
      status: 200,
      headers: responseHeaders,
    });
  }

  status(status: number, headers: HeadersInit = {}): Response {
    const responseHeaders = new Headers(headers);
    this._mergeHeaders(responseHeaders);
    this._appendCookies(responseHeaders);
    this._appendRequestId(responseHeaders);
    this._appendServerTiming(responseHeaders);
    return new Response(null, { status, headers: responseHeaders });
  }

  sse(): SSEWriter {
    let _closed = false;
    let _controller: ReadableStreamDefaultController | null = null;
    let currentId: string | null = null;
    let retryMs: number | null = null;

    const stream = new ReadableStream({
      start(controller) {
        _controller = controller;
        if (retryMs !== null) {
          controller.enqueue(new TextEncoder().encode(`retry: ${retryMs}\n\n`));
        }
      },
      cancel() {
        _closed = true;
        _controller = null;
      },
    });

    const headers = new Headers({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    this._mergeHeaders(headers);
    this._appendCookies(headers);
    this._appendRequestId(headers);
    this._appendServerTiming(headers);

    (this as any)._res = new Response(stream, { headers });

    return {
      get closed() {
        return _closed;
      },
      id(id: string) {
        currentId = id;
      },
      retry(ms: number) {
        retryMs = ms;
      },
      send(event: string, data: string): boolean {
        if (_closed || !_controller) return false;
        let msg = "";
        if (currentId) msg += `id: ${currentId}\n`;
        if (event) msg += `event: ${event}\n`;
        msg += `data: ${data}\n\n`;
        try {
          _controller.enqueue(new TextEncoder().encode(msg));
        } catch {
          _closed = true;
          return false;
        }
        return true;
      },
      close() {
        if (_closed || !_controller) return;
        _closed = true;
        try {
          _controller.close();
        } catch {
          // already closed
        }
        _controller = null;
      },
    };
  }

  getCookie(name: string): string | undefined {
    const cookieHeader = this.req.headers.get("Cookie");
    if (!cookieHeader) return undefined;
    const cookies = cookieHeader.split(";").reduce(
      (acc, cookie) => {
        const [key, value] = cookie.split("=").map((c) => c.trim());
        acc[key] = value;
        return acc;
      },
      {} as Record<string, string>,
    );
    return cookies[name];
  }

  setCookie(name: string, value: string, options: CookieOptions = {}) {
    let cookieString = `${name}=${value}`;
    if (options.domain) cookieString += `; Domain=${options.domain}`;
    if (options.path) cookieString += `; Path=${options.path}`;
    if (options.expires)
      cookieString += `; Expires=${options.expires.toUTCString()}`;
    if (options.maxAge) cookieString += `; Max-Age=${options.maxAge}`;
    if (options.httpOnly) cookieString += `; HttpOnly`;
    if (options.secure) cookieString += `; Secure`;
    if (options.sameSite) cookieString += `; SameSite=${options.sameSite}`;

    this._setCookies.push(cookieString);
  }

  serverTiming(name: string, durationMs: number, description?: string) {
    this._serverTimings.push({
      name,
      duration: durationMs,
      description,
    });
  }

  time<T>(name: string, fn: () => T | Promise<T>): Promise<T> {
    const start = performance.now();
    const result = fn();
    if (result instanceof Promise) {
      return result.then((val) => {
        this.serverTiming(name, performance.now() - start);
        return val;
      });
    }
    this.serverTiming(name, performance.now() - start);
    return Promise.resolve(result);
  }

  // --- Streaming helpers ---

  stream(
    stream: ReadableStream,
    status: number = 200,
    headers: HeadersInit = {},
  ): Response {
    const responseHeaders = new Headers(headers);
    this._mergeHeaders(responseHeaders);
    this._appendCookies(responseHeaders);
    this._appendRequestId(responseHeaders);
    this._appendServerTiming(responseHeaders);
    return new Response(stream, { status, headers: responseHeaders });
  }

  // --- Cache-Control helpers ---

  cacheControl(directives: CacheControlDirectives) {
    const parts: string[] = [];

    if (directives.public) parts.push("public");
    if (directives.private) parts.push("private");
    if (directives.noCache) parts.push("no-cache");
    if (directives.noStore) parts.push("no-store");
    if (directives.noTransform) parts.push("no-transform");
    if (directives.mustRevalidate) parts.push("must-revalidate");
    if (directives.proxyRevalidate) parts.push("proxy-revalidate");
    if (directives.mustUnderstand) parts.push("must-understand");
    if (directives.immutable) parts.push("immutable");
    if (directives.maxAge !== undefined)
      parts.push(`max-age=${directives.maxAge}`);
    if (directives.sMaxAge !== undefined)
      parts.push(`s-maxage=${directives.sMaxAge}`);
    if (directives.staleWhileRevalidate !== undefined)
      parts.push(`stale-while-revalidate=${directives.staleWhileRevalidate}`);
    if (directives.staleIfError !== undefined)
      parts.push(`stale-if-error=${directives.staleIfError}`);

    this.setHeader("Cache-Control", parts.join(", "));
  }

  etag(hash: string) {
    this.setHeader("ETag", `"${hash}"`);
    // Check If-None-Match
    if (this.req.headers.get("If-None-Match") === `"${hash}"`) {
      return this.status(304);
    }
    return null;
  }

  lastModified(date: Date | string | number) {
    const d =
      typeof date === "string" || typeof date === "number"
        ? new Date(date)
        : date;
    this.setHeader("Last-Modified", d.toUTCString());

    const ifModifiedSince = this.req.headers.get("If-Modified-Since");
    if (ifModifiedSince && new Date(ifModifiedSince) >= d) {
      return this.status(304);
    }
    return null;
  }

  // --- FormData support ---

  private _formDataParsed = false;
  private _formData: FormData | null = null;

  async formData(): Promise<FormData> {
    if (this._formDataParsed) return this._formData!;
    this._formData = await this.req.formData();
    this._formDataParsed = true;
    return this._formData;
  }

  // --- DI container ---

  private static _providers: Map<string | symbol, any> = new Map();

  static provide<T>(token: string | symbol, factory: () => T): void {
    Context._providers.set(token, factory);
  }

  get<T>(token: string | symbol): T {
    const factory = Context._providers.get(token);
    if (!factory) throw new Error(`Provider not found: ${String(token)}`);
    return factory();
  }

  private _appendCookies(headers: Headers) {
    if (this._setCookies.length === 0) return;
    for (const cookie of this._setCookies) {
      headers.append("Set-Cookie", cookie);
    }
  }

  private _mergeHeaders(headers: Headers) {
    if ((this._headers as any).count === 0) return;
    this._headers.forEach((value, key) => {
      if (!headers.has(key)) {
        headers.set(key, value);
      }
    });
  }

  private _appendRequestId(headers: Headers) {
    if (
      this.requestId &&
      !headers.has(this._requestIdHeaderName.toLowerCase())
    ) {
      headers.set(this._requestIdHeaderName, this.requestId);
    }
  }

  private _appendServerTiming(headers: Headers) {
    if (this._serverTimings.length === 0) return;
    const value = this._serverTimings
      .map((t) => {
        let entry = t.name;
        if (t.description) entry += `;desc="${t.description}"`;
        entry += `;dur=${Math.round(t.duration)}`;
        return entry;
      })
      .join(", ");
    headers.set("Server-Timing", value);
  }
}
