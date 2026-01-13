import { jwt, sign } from "@bklarjs/jwt";
import { cors } from "@bklarjs/cors";
import { rateLimit } from "@bklarjs/rate-limit";
import { staticFiles } from "@bklarjs/static";
import { swagger } from "@bklarjs/swagger";
import { Bklar, type InferContext } from "bklar";
import { NotFoundError, UnauthorizedError } from "bklar/errors";
import { z } from "zod";
import { cron } from "@bklarjs/cron";
import { helmet } from "@bklarjs/helmet";
import { compression } from "@bklarjs/compression";
import { upload } from "@bklarjs/upload";

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
app.use(compression());
app.use(helmet());
// --- 2. Plugins ---
app.use(cors({ origin: ["http://localhost:3000"] }));
app.use(rateLimit({ max: 100 }));
app.use(staticFiles({ root: "./public" }));
const uploadMiddleware = upload({
  dest: "./uploads",
  maxSize: 5 * 1024 * 1024, // 5MB limit
  types: ["image/png", "image/jpeg", "image/gif", "image/webp"], // Only allow images
});

app.post(
  "/upload",
  (ctx) => {
    // Regular form fields are in ctx.body
    const { username } = ctx.body;

    // Files are in ctx.state.files
    const avatar = ctx.state.files?.avatar;

    if (!avatar) {
      return ctx.json({ error: "Avatar is required" }, 400);
    }

    // If 'dest' is set, avatar is an UploadedFile object
    return ctx.json({
      message: "File uploaded!",
      file: avatar,
      // avatar.path -> "uploads/f47ac10b-58cc-4372-a567-0e02b2c3d479.png"
    });
  },
  {
    middlewares: [uploadMiddleware],
  }
);

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

app.use(
  cron({
    name: "execTest",
    pattern: "* * * * * *", // every second
    autoStart: false,
    run: () => {
      const time = new Date().toISOString();
      console.log("Cron job executed", time);
    },
  })
);

app.post("/jobs/:name/stop", (ctx) => {
  const { name } = ctx.params;
  const job = ctx.state.cron[name];

  if (!job) {
    return ctx.json({ error: "Job not found" }, 404);
  }

  job.stop();
  return ctx.json({ message: `Job '${name}' stopped.` });
});

swagger({ path: "/docs" }).setup(app);

app.listen(4000);

export type AppType = typeof app;
