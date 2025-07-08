#!/usr/bin/env bun

import chalk from "chalk";
import { execa } from "execa";
import fs from "fs/promises";
import path from "path";
import prompts from "prompts";

async function main() {
  console.log(`\n${chalk.bold.cyan("🐰 Welcome to bklar!")}`);
  console.log("Let's create a new project for you.\n");

  let projectDir: string | undefined = process.argv[2];
  let selectedPlugins: string[] = [];
  let projectType: string;

  if (projectDir) {
    // --- NON-INTERACTIVE MODE ---
    console.log(`Project name provided: ${chalk.yellow(projectDir)}.`);
    console.log("Using 'Minimal' template by default.");
    projectType = "minimal";
  } else {
    // --- INTERACTIVE MODE ---
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

    projectDir = initialSetup.projectName;
    projectType = initialSetup.projectType;

    if (projectType === "rest-api") {
      selectedPlugins = ["cors", "jwt", "rate-limit"];
    } else if (projectType === "custom") {
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
  }

  if (!projectDir) {
    console.log(chalk.red("\n✖ Project creation cancelled."));
    return;
  }

  const targetPath = path.resolve(process.cwd(), projectDir);

  // Check if the target directory already exists.
  try {
    await fs.access(targetPath);
    console.error(
      chalk.red(
        `\n✖ Directory "${projectDir}" already exists. Please choose another name or delete it.`
      )
    );
    process.exit(1);
  } catch (e) {
    // This is the expected outcome, as the directory should not exist.
  }

  // --- Scaffolding Logic (CORRECTED ORDER) ---
  const templatePath = path.resolve(import.meta.dir, "template");
  console.log(`\nCreating project in ${chalk.yellow(targetPath)}...`);

  // ** STEP 1: Copy all template files FIRST. **
  await fs.cp(templatePath, targetPath, { recursive: true });

  // ** STEP 2: Now that files exist, modify them. **

  // Rename 'gitignore' to '.gitignore'
  const gitignorePath = path.join(targetPath, "gitignore");
  const dotGitignorePath = path.join(targetPath, ".gitignore");
  try {
    await fs.rename(gitignorePath, dotGitignorePath);
  } catch (error) {
    // This might fail if the template 'gitignore' file doesn't exist, which is fine.
    console.warn(chalk.yellow("Could not create .gitignore file."));
  }

  // Modify package.json with the project name and selected plugins.
  const packageJsonPath = path.join(targetPath, "package.json");
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf-8"));
  packageJson.name = projectDir.toLowerCase().replace(/\s+/g, "-");

  if (selectedPlugins.length > 0) {
    for (const plugin of selectedPlugins) {
      packageJson.dependencies[`@bklarjs/${plugin}`] = "latest";
    }
  }
  await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));

  // Modify index.ts to include setup code for the selected plugins.
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

  if (importsToAdd) {
    indexContent = importsToAdd + indexContent;
  }
  if (setupCode) {
    indexContent = indexContent.replace(
      "const app = Bklar();",
      `const app = Bklar();${setupCode}`
    );
  }
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
  if (err.isTtyError) {
    // Handle cases where `prompts` is used in a non-interactive environment.
    console.error(
      chalk.red(
        "\n✖ This command can't be run in a non-interactive environment without a project name."
      )
    );
    console.error(chalk.cyan("  Try running: bun create bklar <project-name>"));
  } else {
    console.error(chalk.red("\nAn unexpected error occurred:"), err);
  }
  process.exit(1);
});
