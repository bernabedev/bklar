import { State } from "./types";

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
  // Store cookies to be set in the response
  public _setCookies: string[] = [];

  constructor(req: Request, params: T["params"]) {
    this.req = req;
    this.params = params;
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
      const contentType = this.req.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        this.body = await this.req.json();
      } else if (contentType?.includes("application/x-www-form-urlencoded")) {
        const formData = await this.req.formData();
        this.body = Object.fromEntries(formData.entries()) as T["body"];
      }
    } catch (error) {
      // Ignore body parsing errors, validation will catch empty body if required
    } finally {
      this.bodyParsed = true;
    }
  }

  json(
    data: object,
    status: number = 200,
    headers: HeadersInit = {}
  ): Response {
    const responseHeaders = new Headers(headers);
    responseHeaders.set("Content-Type", "application/json");
    this._appendCookies(responseHeaders);
    return new Response(JSON.stringify(data), {
      status,
      headers: responseHeaders,
    });
  }

  text(
    data: string,
    status: number = 200,
    headers: HeadersInit = {}
  ): Response {
    const responseHeaders = new Headers(headers);
    responseHeaders.set("Content-Type", "text/plain;charset=UTF-8");
    this._appendCookies(responseHeaders);
    return new Response(data, {
      status,
      headers: responseHeaders,
    });
  }

  status(status: number, headers: HeadersInit = {}): Response {
    const responseHeaders = new Headers(headers);
    this._appendCookies(responseHeaders);
    return new Response(null, { status, headers: responseHeaders });
  }

  getCookie(name: string): string | undefined {
    const cookieHeader = this.req.headers.get("Cookie");
    if (!cookieHeader) return undefined;
    const cookies = cookieHeader.split(";").reduce((acc, cookie) => {
      const [key, value] = cookie.split("=").map((c) => c.trim());
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);
    return cookies[name];
  }

  setCookie(name: string, value: string, options: CookieOptions = {}) {
    let cookieString = `${name}=${value}`;
    if (options.domain) cookieString += `; Domain=${options.domain}`;
    if (options.path) cookieString += `; Path=${options.path}`;
    if (options.expires) cookieString += `; Expires=${options.expires.toUTCString()}`;
    if (options.maxAge) cookieString += `; Max-Age=${options.maxAge}`;
    if (options.httpOnly) cookieString += `; HttpOnly`;
    if (options.secure) cookieString += `; Secure`;
    if (options.sameSite) cookieString += `; SameSite=${options.sameSite}`;
    
    this._setCookies.push(cookieString);
  }

  private _appendCookies(headers: Headers) {
    for (const cookie of this._setCookies) {
      headers.append("Set-Cookie", cookie);
    }
  }
}
