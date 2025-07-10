import { cors } from "@bklarjs/cors";
import { jwt, sign } from "@bklarjs/jwt";
import { rateLimit } from "@bklarjs/rate-limit";
import { staticServer } from "@bklarjs/static";
import { swagger } from "@bklarjs/swagger";
import { Bklar } from "bklar";
import { NotFoundError, UnauthorizedError } from "bklar/errors";
import { z } from "zod";

const app = Bklar();

app.onRequest((ctx) => {
  console.log("Request received");
});
app.preParse((ctx) => {
  console.log("Pre-parsing");
});
app.preValidation((ctx) => {
  console.log("Pre-validation");
});
app.preHandler((ctx) => {
  console.log("Pre-handler");
});
app.onError((ctx) => {
  console.log("Error");
});
app.onResponse((ctx) => {
  console.log("Response");
});

app.use(cors({ origin: true }));
app.use(rateLimit({ max: 100 }));
app.use(staticServer({ root: "./public" }));
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
    return USERS.map(({ password, ...user }) => user); // Never expose passwords
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
      // In a real app, you'd use bcrypt.compare()
      throw new UnauthorizedError("Invalid email or password");
    }
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  },
};

// --- Public Routes ---

app.get("/health", (ctx) => {
  return ctx.json({ status: "ok" });
});

app.get(
  "/users",
  (ctx) => {
    const users = UserService.getAll();
    return ctx.json(users);
  },
  {
    doc: {
      tags: ["Users"],
      description: "Get all users",
      summary: "Get all users (public)",
    },
    schemas: {
      query: z.object({
        page: z.coerce.number().default(1),
        limit: z.coerce.number().default(10),
      }),
    },
  }
);

app.get(
  "/users/:id",
  (ctx) => {
    const user = UserService.find(ctx.params.id);
    return ctx.json(user);
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

    return ctx.json({ token });
  },
  {
    schemas: { body: loginSchema },
  }
);

// --- Protected Routes ---

const authMiddleware = jwt<{ email: string }>({ secret: JWT_SECRET });

// Protected profile route
app.get(
  "/profile",
  (ctx) => {
    const userPayload = ctx.state.jwt;
    userPayload?.email;
    const user = UserService.find(Number(userPayload?.sub));
    return ctx.json({
      message: "This is a protected route. Welcome!",
      user,
    });
  },
  {
    middlewares: [authMiddleware],
  }
);

// Protected PUT route with auth middleware
app.put(
  "/users/:id",
  (ctx) => {
    console.log(`User ${ctx.state.jwt?.sub} is updating user ${ctx.params.id}`);
    return ctx.json({ ...ctx.body, id: ctx.params.id });
  },
  {
    middlewares: [authMiddleware],
    schemas: {
      params: z.object({ id: z.coerce.number() }),
      body: z.object({ name: z.string() }),
    },
  }
);

swagger({ path: "/docs" }).setup(app);
app.listen(4000);
