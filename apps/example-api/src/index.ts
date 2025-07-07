import { createApp, Middleware } from "@framework/core";
import { z } from "zod";

const app = createApp();

app.get("/", (ctx) => {
  return ctx.json({ message: "Hello, World!" });
});

app.get("/users", (ctx) => {
  return ctx.json({ users: [] });
});

app.get("/users/:id", {
  schemas: {
    params: z.object({
      id: z.string(),
    }),
  },
  handler: (ctx) => {
    return ctx.json({ user: ctx.params.id });
  },
});

const userSchema = z.object({
  name: z.string().min(3),
  email: z.string().email(),
});

app.post("/users", {
  schemas: {
    body: userSchema,
  },
  handler: (ctx) => {
    const newUser = ctx.body;
    console.log("Creating user:", newUser.name, newUser.email);
    return ctx.json({ id: 1, ...newUser }, 201);
  },
});

const authMiddleware: Middleware = (ctx) => {
  const authHeader = ctx.req.headers.get("Authorization");
  if (authHeader !== "Bearer my-secret-token") {
    throw new Error("Unauthorized");
  }
  ctx.state.user = { id: 123, role: "admin" };
};

app.get("/profile", [authMiddleware], (ctx) => {
  return ctx.json({ user: ctx.state.user });
});

app.listen(4000);
