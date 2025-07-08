#!/usr/bin/env bun

import chalk from "chalk";
import { execa } from "execa";
import fs from "fs/promises";
import path from "path";
import prompts from "prompts";

async function main() {
  console.log(`\n${chalk.bold.cyan("🐰 Welcome to bklar!")}`);
  console.log("Let's create a new project for you.\n");

  const initialSetup = await prompts([
    {
      type: "text",
      name: "projectName",
      message: "What is the name of your project?",
      initial: "my-bklar-app",
      validate: (name) =>
        name.length > 0 ? true : "Project name cannot be empty.",
    },
    {
      type: "select",
      name: "projectType",
      message: "Choose a project template:",
      choices: [
        {
          title: "Minimal",
          description: "A blank slate. Just the bare essentials.",
          value: "minimal",
        },
        {
          title: "REST API Starter",
          description: "A pre-configured setup with common plugins.",
          value: "rest-api",
        },
        {
          title: "Custom",
          description: "Choose exactly which features you want.",
          value: "custom",
        },
      ],
    },
  ]);

  if (!initialSetup.projectName) {
    console.log(chalk.red("\n✖ Project creation cancelled."));
    return;
  }

  const projectDir = initialSetup.projectName;
  const targetPath = path.resolve(process.cwd(), projectDir);

  // --- Check if directory already exists ---
  try {
    await fs.access(targetPath);
    console.error(
      chalk.red(
        `\n✖ Directory "${projectDir}" already exists. Please choose another name or delete it.`
      )
    );
    process.exit(1);
  } catch (e) {
    // This is good, directory does not exist.
  }

  // --- Determine which plugins to install based on template ---
  let selectedPlugins: string[] = [];

  if (initialSetup.projectType === "rest-api") {
    // REST API starter includes common plugins by default
    selectedPlugins = ["cors", "jwt", "rate-limit"];
  } else if (initialSetup.projectType === "custom") {
    const customSetup = await prompts({
      type: "multiselect",
      name: "plugins",
      message: "Which official plugins would you like to include?",
      choices: [
        { title: "CORS Middleware (@bklarjs/cors)", value: "cors" },
        { title: "JWT Authentication (@bklarjs/jwt)", value: "jwt" },
        { title: "Rate Limiter (@bklarjs/rate-limit)", value: "rate-limit" },
      ],
      hint: "- Space to select. Return to submit.",
    });
    selectedPlugins = customSetup.plugins || [];
  }
  // For 'minimal', selectedPlugins remains empty.

  const templatePath = path.resolve(import.meta.dir, "template");
  console.log(`\nCreating project in ${chalk.yellow(targetPath)}...`);

  // --- Scaffold Project Files ---
  await fs.cp(templatePath, targetPath, { recursive: true });

  // Modify package.json
  const packageJsonPath = path.join(targetPath, "package.json");
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf-8"));
  packageJson.name = projectDir.toLowerCase().replace(/\s+/g, "-");

  if (selectedPlugins.length > 0) {
    for (const plugin of selectedPlugins) {
      packageJson.dependencies[`@bklarjs/${plugin}`] = "latest";
    }
  }
  await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));

  // Modify index.ts to include setup code for selected plugins
  const indexPath = path.join(targetPath, "index.ts");
  let indexContent = await fs.readFile(indexPath, "utf-8");

  let importsToAdd = "";
  let setupCode = "";

  if (selectedPlugins.includes("cors")) {
    importsToAdd += `import { cors } from "@bklarjs/cors";\n`;
    setupCode += `\n// Enable CORS for all origins\napp.use(cors());\n`;
  }
  if (selectedPlugins.includes("rate-limit")) {
    importsToAdd += `import { rateLimit } from "@bklarjs/rate-limit";\n`;
    setupCode += `\n// Apply a global rate limit\napp.use(rateLimit({ windowMs: 60 * 1000, max: 100 }));\n`;
  }

  indexContent = importsToAdd + indexContent;
  indexContent = indexContent.replace(
    "const app = Bklar();",
    `const app = Bklar();${setupCode}`
  );
  await fs.writeFile(indexPath, indexContent);

  console.log(chalk.green("\n✔ Project files created successfully!"));

  // --- Final Steps ---
  try {
    await execa("git", ["init"], { cwd: targetPath });
    await execa("git", ["add", "."], { cwd: targetPath });
    await execa("git", ["commit", "-m", "Initial commit from create-bklar"], {
      cwd: targetPath,
    });
    console.log("✔ Initialized Git repository.");
  } catch (e) {
    console.warn(
      chalk.yellow(
        "Could not initialize Git repository. You can do so manually."
      )
    );
  }

  const { installDeps } = await prompts({
    type: "confirm",
    name: "installDeps",
    message: "Would you like to install the dependencies now?",
    initial: true,
  });

  if (installDeps) {
    console.log("\nInstalling dependencies... This might take a moment.");
    try {
      await execa("bun", ["install"], { cwd: targetPath, stdio: "inherit" });
      console.log(chalk.green("✔ Dependencies installed."));
    } catch (error) {
      console.warn(
        chalk.yellow(
          "\nCould not install dependencies. Please run 'bun install' manually."
        )
      );
    }
  }

  console.log(chalk.bold("\nNext steps:"));
  if (!installDeps) {
    console.log(`  1. ${chalk.cyan(`cd ${projectDir}`)}`);
    console.log(`  2. ${chalk.cyan("bun install")}`);
    console.log(`  3. ${chalk.cyan("bun run dev")}`);
  } else {
    console.log(`  1. ${chalk.cyan(`cd ${projectDir}`)}`);
    console.log(`  2. ${chalk.cyan("bun run dev")}`);
  }

  console.log("\nHappy coding!");
}

main().catch((err) => {
  console.error(chalk.red("\nAn unexpected error occurred:"), err);
  process.exit(1);
});
