#!/usr/bin/env bun

import chalk from "chalk";
import fs from "fs/promises";
import path from "path";
import prompts from "prompts";

async function main() {
  console.log(`\n${chalk.bold.cyan("🐰 Welcome to bklar!")}`);
  console.log("Let's create a new project for you.\n");

  let projectDir = process.argv[2];

  if (!projectDir) {
    const response = await prompts({
      type: "text",
      name: "projectName",
      message: "What is the name of your project?",
      initial: "my-bklar-app",
    });
    projectDir = response.projectName;
  }

  if (!projectDir) {
    console.log(chalk.red("\n✖ Project creation cancelled."));
    return;
  }

  const targetPath = path.resolve(process.cwd(), projectDir);
  const templatePath = path.resolve(import.meta.dir, "template");

  try {
    await fs.access(targetPath);
    console.error(
      chalk.red(
        `\n✖ Directory "${projectDir}" already exists. Please choose another name.`
      )
    );
    process.exit(1);
  } catch (e) {
    // Directory does not exist, which is good.
  }

  console.log(`\nCreating project in ${chalk.yellow(targetPath)}...`);

  await fs.mkdir(targetPath, { recursive: true });
  await fs.cp(templatePath, targetPath, { recursive: true });

  const packageJsonPath = path.join(targetPath, "package.json");
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf-8"));
  packageJson.name = projectDir.toLowerCase().replace(/\s+/g, "-");
  await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));

  console.log(chalk.green("\n✔ Project created successfully!"));
  console.log(chalk.bold("\nNext steps:"));
  console.log(`  1. ${chalk.cyan(`cd ${projectDir}`)}`);
  console.log(`  2. ${chalk.cyan("bun install")}`);
  console.log(`  3. ${chalk.cyan("bun run dev")}`);
  console.log("\nHappy coding!");
}

main().catch((error) => {
  console.error(chalk.red("\nAn unexpected error occurred:"), error);
  process.exit(1);
});
