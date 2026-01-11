import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { z } from "zod";
import { Bklar } from "../app";
import { bklarClient } from "../client";

// Define App
const app = Bklar()
  .get("/hello", () => {
    return { message: "Hello World" }; // Direct object return
  })
  .post(
    "/echo",
    (ctx) => {
      return ctx.body;
    },
    {
      schemas: {
        body: z.object({ text: z.string() }),
      },
    }
  )
  .get(
    "/users/:id",
    (ctx) => {
      // Test Cookies
      ctx.setCookie("session", "12345", { httpOnly: true });
      return { id: ctx.params.id, name: "User" };
    },
    {
      schemas: {
        params: z.object({ id: z.string() }),
      },
    }
  )
  .get("/cookies", (ctx) => {
      return { cookie: ctx.getCookie("test-cookie") };
  });

type AppType = typeof app;

describe("RPC & Type Inference", () => {
  let server: any;
  const port = 3001;
  const baseUrl = `http://localhost:${port}`;
  const client = bklarClient<AppType>(baseUrl);

  beforeAll(() => {
    server = app.listen(port);
  });

  afterAll(() => {
    server.stop();
  });

  it("should infer and handle simple GET request", async () => {
    // Type check: client.hello.get() should return Promise<{ message: string }>
    const res = await client.hello.get({});
    expect(res).toEqual({ message: "Hello World" });
  });

  it("should infer and handle POST request with body", async () => {
    const res = await client.echo.post({
      body: { text: "RPC Magic" },
    });
    expect(res).toEqual({ text: "RPC Magic" });
  });

  it("should handle nested paths and parameters", async () => {
    // client.users[':id'].get
    const res = await client.users[":id"].get({
      params: { id: "99" },
    });
    expect(res.id).toBe("99");
    expect(res.name).toBe("User");
  });

  it("should handle cookies", async () => {
      // 1. Test setCookie via the /users/:id response headers
      const res = await fetch(`${baseUrl}/users/1`);
      const cookieHeader = res.headers.get('set-cookie');
      expect(cookieHeader).toContain("session=12345");
      expect(cookieHeader).toContain("HttpOnly");

      // 2. Test getCookie
      const res2 = await fetch(`${baseUrl}/cookies`, {
          headers: {
              'Cookie': 'test-cookie=hello-bun'
          }
      });
      const body = await res2.json();
      expect(body.cookie).toBe("hello-bun");
  });
});
