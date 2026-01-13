import fs from "node:fs";
import path from "node:path";
import prompts from "prompts";
import pc from "picocolors";
import {
  banner,
  cwd,
  emptyDir,
  formatTargetDir,
  initGit,
  installDependencies,
  isEmpty,
} from "./utils";
import {
  generateEntryFile,
  generatePackageJson,
  generateTsConfig,
} from "./generator";

async function init() {
  console.log(banner);

  let targetDir = process.argv[2];
  let defaultPlugins: string[] = [];

  const response = await prompts(
    [
      {
        type: targetDir ? null : "text",
        name: "projectName",
        message: "Project name:",
        initial: "my-bklar-app",
        onState: (state) => {
          targetDir = formatTargetDir(state.value) || "my-bklar-app";
        },
      },
      {
        type: () =>
          !fs.existsSync(targetDir) || isEmpty(targetDir) ? null : "confirm",
        name: "overwrite",
        message: () =>
          (targetDir === "."
            ? "Current directory"
            : `Target directory "${targetDir}"`) +
          " is not empty. Remove existing files and continue?",
      },
      {
        type: (_, { overwrite }: { overwrite?: boolean }) => {
          if (overwrite === false)
            throw new Error(pc.red("✖") + " Operation cancelled");
          return null;
        },
        name: "overwriteChecker",
      },
      {
        type: "select",
        name: "structure",
        message: "Select project structure:",
        choices: [
          {
            title: "Minimal",
            description: "Single file (index.ts)",
            value: "minimal",
          },
          {
            title: "Modular",
            description: "Folders (routes/controllers)",
            value: "modular",
          },
        ],
        initial: 0,
      },
      {
        type: "select",
        name: "template",
        message: "Select a template:",
        choices: [
          { title: "Bare", value: "bare", description: "No plugins installed" },
          {
            title: "Standard API",
            value: "standard",
            description: "Logger, CORS, Helmet, Swagger",
          },
          {
            title: "Custom",
            value: "custom",
            description: "Select plugins manually",
          },
        ],
        onState: (state) => {
          if (state.value === "standard")
            defaultPlugins = ["logger", "cors", "helmet", "swagger"];
        },
      },
      {
        type: (prev) => (prev === "custom" ? "multiselect" : null),
        name: "plugins",
        message: "Select plugins:",
        choices: [
          { title: "Logger", value: "logger" },
          { title: "Swagger", value: "swagger" },
          { title: "CORS", value: "cors" },
          { title: "Helmet", value: "helmet" },
          { title: "JWT Auth", value: "jwt" },
          { title: "Uploads", value: "upload" },
          { title: "Caching", value: "cache" },
          { title: "Cron Jobs", value: "cron" },
        ],
        hint: "- Space to select. Return to submit",
      },
      {
        type: "confirm",
        name: "install",
        message: "Install dependencies?",
        initial: true,
      },
      {
        type: "confirm",
        name: "git",
        message: "Initialize Git?",
        initial: true,
      },
    ],
    {
      onCancel: () => {
        throw new Error(pc.red("✖") + " Operation cancelled");
      },
    }
  );

  const root = path.join(cwd, targetDir);
  const projectName = path.basename(root);
  const plugins =
    response.template === "custom" ? response.plugins : defaultPlugins || [];

  if (response.overwrite) emptyDir(root);
  else if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true });

  console.log(`\n${pc.cyan(`Scaffolding project in ${root}...`)}`);

  // 1. Generate package.json
  const pkg = generatePackageJson({
    projectName,
    isModular: response.structure === "modular",
    plugins,
  });
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify(pkg, null, 2)
  );

  // 2. Generate config
  fs.writeFileSync(path.join(root, "tsconfig.json"), generateTsConfig());

  // 3. Create Source
  fs.mkdirSync(path.join(root, "src"), { recursive: true });

  // 4. Generate Code
  const entryCode = generateEntryFile({
    projectName,
    isModular: response.structure === "modular",
    plugins,
  });
  fs.writeFileSync(path.join(root, "src", "index.ts"), entryCode.trim());

  if (response.structure === "modular") {
    fs.mkdirSync(path.join(root, "src", "controllers"));
    const ctrlCode = `
import type { Context } from "bklar";
export class HealthController {
  static async check(ctx: Context<any>) {
    return ctx.json({ status: "ok", timestamp: Date.now() });
  }
}`;
    fs.writeFileSync(
      path.join(root, "src", "controllers", "health.ts"),
      ctrlCode.trim()
    );
  }

  if (response.install) installDependencies(root);
  if (response.git) initGit(root);

  console.log(`\n${pc.green("✔ Project created successfully!")}`);
  console.log(`\nNext steps:`);
  if (root !== cwd) console.log(`  cd ${targetDir}`);
  if (!response.install) console.log(`  bun install`);
  console.log(`  bun run dev`);
  console.log(`\nHappy coding! 🐰\n`);
}

init().catch((e) => console.error(e instanceof Error ? e.message : e));
