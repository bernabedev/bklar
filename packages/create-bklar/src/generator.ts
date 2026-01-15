export interface TemplateOptions {
  projectName: string;
  isModular: boolean;
  plugins: string[];
}

export function generatePackageJson(options: TemplateOptions) {
  const deps: Record<string, string> = {
    bklar: "^2.0.0",
    zod: "^4.0.0",
  };

  const devDeps: Record<string, string> = {
    "@types/bun": "latest",
    typescript: "^5.0.0",
  };

  // Official Plugins Map
  const pluginMap: Record<string, string> = {
    cors: "@bklarjs/cors",
    helmet: "@bklarjs/helmet",
    jwt: "@bklarjs/jwt",
    logger: "@bklarjs/logger",
    upload: "@bklarjs/upload",
    swagger: "@bklarjs/swagger",
    cron: "@bklarjs/cron",
    cache: "@bklarjs/cache",
    "rate-limit": "@bklarjs/rate-limit",
  };

  // Plugin Version Map (Detected from monorepo packages)
  const pluginVersions: Record<string, string> = {
    "@bklarjs/cors": "^2.0.0",
    "@bklarjs/helmet": "^1.0.0",
    "@bklarjs/jwt": "^2.0.0",
    "@bklarjs/logger": "^1.0.0",
    "@bklarjs/upload": "^1.0.0",
    "@bklarjs/swagger": "^2.0.0",
    "@bklarjs/cron": "^1.0.0",
    "@bklarjs/cache": "^1.0.0",
    "@bklarjs/rate-limit": "^2.0.0",
  };

  options.plugins.forEach((p) => {
    if (pluginMap[p]) {
      deps[pluginMap[p]] = pluginVersions[pluginMap[p]];
    }
    // Specific overrides if needed
    if (p === "jwt") deps["jose"] = "^6.0.0";
  });

  return {
    name: options.projectName,
    version: "0.0.1",
    type: "module",
    scripts: {
      dev: "bun run --watch src/index.ts",
      start: "bun run src/index.ts",
      test: "bun test",
    },
    dependencies: deps,
    devDependencies: devDeps,
  };
}

export function generateEntryFile(options: TemplateOptions): string {
  const imports: string[] = ['import { Bklar } from "bklar";'];
  const middlewares: string[] = [];
  const setups: string[] = [];

  // Plugin Setup Logic
  if (options.plugins.includes("logger")) {
    imports.push('import { logger } from "@bklarjs/logger";');
    middlewares.push("app.use(logger());");
  }
  if (options.plugins.includes("cors")) {
    imports.push('import { cors } from "@bklarjs/cors";');
    middlewares.push("app.use(cors());");
  }
  if (options.plugins.includes("helmet")) {
    imports.push('import { helmet } from "@bklarjs/helmet";');
    middlewares.push("app.use(helmet());");
  }
  if (options.plugins.includes("rate-limit")) {
    imports.push('import { rateLimit } from "@bklarjs/rate-limit";');
    middlewares.push("app.use(rateLimit());");
  }
  if (options.plugins.includes("swagger")) {
    imports.push('import { swagger } from "@bklarjs/swagger";');
    setups.push(`
swagger({
  openapi: {
    title: "${options.projectName}",
    version: "1.0.0"
  }
}).setup(app);`);
  }

  // Routes Logic
  let routes = `
app.get("/", (ctx) => {
  return ctx.json({ 
    message: "Welcome to ${options.projectName}! 🐰",
    docs: "https://github.com/bernabedev/bklar" 
  });
});`;

  if (options.isModular) {
    imports.push('import { HealthController } from "./controllers/health";');
    routes = `
app.get("/", (ctx) => ctx.text("Welcome to Modular Bklar!"));
app.get("/health", HealthController.check);
`;
  }

  return `
${imports.join("\n")}

const app = Bklar();

// --- Middlewares ---
${middlewares.join("\n")}

// --- Routes ---
${routes.trim()}

${setups.join("\n")}

app.listen(3000, () => {
  console.log("🐰 Server running at http://localhost:3000");
});
`;
}

export function generateTsConfig() {
  return JSON.stringify(
    {
      compilerOptions: {
        lib: ["ESNext"],
        module: "esnext",
        target: "esnext",
        moduleResolution: "bundler",
        moduleDetection: "force",
        allowImportingTsExtensions: true,
        noEmit: true,
        strict: true,
        skipLibCheck: true,
        noFallthroughCasesInSwitch: true,
        noUncheckedIndexedAccess: true,
      },
    },
    null,
    2
  );
}
