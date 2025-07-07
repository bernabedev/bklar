import { createApp } from "@bklar/core";
import { z } from "zod";

const app = createApp();

// --- CASE 1: Simple, handler only ---
app.get("/health", (ctx) => {
  return ctx.json({ status: "ok" });
});

// --- CASE 2: Handler + Middlewares + Validation ---
const paramsSchema = z.object({ id: z.string().uuid() });
const bodySchema = z.object({ name: z.string() });

app.put(
  "/users/:id",
  // 1. Handler (with inferred types)
  (ctx) => {
    // ctx.params.id is a string validated as a UUID
    // ctx.body.name is a validated string
    // ctx.state.user was added by authMiddleware
    console.log(`Updating user ${ctx.params.id}`);
    return ctx.json({ ...ctx.body, id: ctx.params.id });
  },
  // 2. Options (middlewares and schemas)
  {
    // middlewares: [authMiddleware],
    schemas: {
      params: paramsSchema,
      body: bodySchema,
    },
  }
);

app.listen(4000);
