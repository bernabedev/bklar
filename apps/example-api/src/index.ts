import { Bklar } from "bklar";
import { NotFoundError } from "bklar/errors";
import { z } from "zod";
// { logger: false } // Deshabilita el logging
const app = Bklar();

// --- CASE 1: Simple, handler only ---
app.get("/health", (ctx) => {
  return ctx.json({ status: "ok" });
});

// --- CASE 2: Handler + Middlewares + Validation ---
const paramsSchema = z.object({ id: z.string().uuid() });
const bodySchema = z.object({ name: z.string() });

const USERS = [
  { id: "1", name: "John Doe" },
  { id: "2", name: "Jane Doe" },
];

const UserService = {
  getAll: () => {
    return USERS;
  },
  find: (id: string) => {
    const user = USERS.find((user) => user.id === id);
    if (!user) throw new NotFoundError("User not found");
    return user;
  },
};

app.get(
  "/users",
  (ctx) => {
    const users = UserService.getAll();
    return ctx.json(users);
  },
  {
    schemas: {
      query: z.object({
        page: z.coerce.number().default(1),
        limit: z.coerce.number().default(10),
      }),
    },
  }
);

app.get("/users/:id", (ctx) => {
  const user = UserService.find(ctx.params.id);
  return ctx.json(user);
});

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
