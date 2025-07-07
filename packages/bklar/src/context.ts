export class Context<T extends { query: any; params: any; body: any }> {
  public readonly req: Request;
  public state: Record<string, unknown> = {};
  public params: T["params"];
  public query: T["query"] = {} as T["query"];
  public body: T["body"] = {} as T["body"];
  private bodyParsed = false;

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
    return new Response(JSON.stringify(data), {
      status,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  text(
    data: string,
    status: number = 200,
    headers: HeadersInit = {}
  ): Response {
    return new Response(data, {
      status,
      headers: { ...headers, "Content-Type": "text/plain;charset=UTF-8" },
    });
  }

  status(status: number, headers: HeadersInit = {}): Response {
    return new Response(null, { status, headers });
  }
}
