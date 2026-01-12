import { jwt, sign } from "@bklarjs/jwt";
// import { rateLimit } from "@bklarjs/rate-limit";
// import { staticServer } from "@bklarjs/static";
import { Bklar, type InferContext } from "bklar";
import { NotFoundError, UnauthorizedError } from "bklar/errors";
import { z } from "zod";

const app = Bklar();

// --- 1. Global Middleware (Replacements for onRequest/onResponse hooks) ---
// Corrected Logger Middleware using correct v2 pattern
app.use(async (ctx, next) => {
  const start = performance.now();
  console.log(`-> ${ctx.req.method} ${ctx.req.url}`);

  const res = await next();

  const ms = performance.now() - start;
  let status = 200;
  if (res instanceof Response) {
    status = res.status;
  }
  console.log(
    `<- ${ctx.req.method} ${ctx.req.url} ${status} - ${ms.toFixed(2)}ms`
  );

  return res;
});

// --- 2. Plugins ---
// app.use(cors({ origin: true }));
// app.use(rateLimit({ max: 100 }));
// app.use(staticServer({ root: "./public" }));

const JWT_SECRET = "a-super-secret-key-that-should-be-in-an-env";

// --- Mock Database and User Service ---
const USERS = [
  {
    id: 1,
    name: "John Doe",
    email: "john.doe@example.com",
    password: "password123",
  },
  {
    id: 2,
    name: "Jane Doe",
    email: "jane.doe@example.com",
    password: "password456",
  },
];

const UserService = {
  getAll: () => {
    return USERS.map(({ password, ...user }) => user);
  },
  find: (id: number) => {
    const user = USERS.find((user) => user.id === id);
    if (!user) throw new NotFoundError("User not found");
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  },
  login: (email: string, pass: string) => {
    const user = USERS.find((user) => user.email === email);
    if (!user || user.password !== pass) {
      throw new UnauthorizedError("Invalid email or password");
    }
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  },
};

// --- Public Routes ---

app.get(
  "/health",
  () => {
    return { status: "ok" };
  },
  {
    doc: {
      tags: ["Health"],
      description: "Health check",
    },
  }
);

const userSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string(),
});

type UserContext = InferContext<{ body: typeof userSchema }>;

class UserController {
  static getAll(ctx: UserContext) {
    return UserService.getAll();
  }
}

app.get("/users", UserController.getAll, {
  doc: {
    tags: ["Users"],
  },
  schemas: {
    query: z.object({
      page: z.coerce.number().default(1),
      limit: z.coerce.number().default(10),
    }),
  },
});

app.get(
  "/users/:id",
  (ctx) => {
    return UserService.find(Number(ctx.params.id));
  },
  {
    schemas: {
      params: z.object({ id: z.coerce.number() }),
    },
  }
);

// --- Login Route ---

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

app.post(
  "/login",
  async (ctx) => {
    const { email, password } = ctx.body;
    const user = UserService.login(email, password);

    const token = await sign(
      { sub: user.id.toString(), email: user.email },
      JWT_SECRET,
      "HS256",
      { expiresIn: "1h" }
    );

    return { token };
  },
  {
    schemas: { body: loginSchema },
  }
);

// --- Protected Routes ---

const authMiddleware = jwt<{ email: string }>({ secret: JWT_SECRET });

app.get(
  "/profile",
  (ctx) => {
    const userPayload = ctx.state.jwt as any; // Cast or use generic if available
    const user = UserService.find(Number(userPayload?.sub));
    return {
      message: "This is a protected route. Welcome!",
      user,
    };
  },
  {
    middlewares: [authMiddleware],
  }
);

// Keep one using ctx.json for backward compatibility demonstration
app.put(
  "/users/:id",
  (ctx) => {
    const userPayload = ctx.state.jwt as any;
    console.log(`User ${userPayload?.sub} is updating user ${ctx.params.id}`);
    return ctx.json({ ...ctx.body, id: ctx.params.id });
  },
  {
    middlewares: [authMiddleware],
    schemas: {
      params: z.object({ id: z.coerce.number() }),
      body: z.object({ name: z.string() }),
    },
    doc: {
      tags: ["Users"],
      summary: "Update a user (protected)",
    },
  }
);

// swagger({ path: "/docs" }).setup(app);

app.listen(4000);

export type AppType = typeof app;
