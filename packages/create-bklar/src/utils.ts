import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import { execSync } from "node:child_process";

export const cwd = process.cwd();

export function formatTargetDir(targetDir: string | undefined) {
  return targetDir?.trim().replace(/\/+$/g, "");
}

export function isEmpty(path: string) {
  const files = fs.readdirSync(path);
  return files.length === 0 || (files.length === 1 && files[0] === ".git");
}

export function emptyDir(dir: string) {
  if (!fs.existsSync(dir)) return;
  for (const file of fs.readdirSync(dir)) {
    if (file === ".git") continue;
    fs.rmSync(path.resolve(dir, file), { recursive: true, force: true });
  }
}

export function installDependencies(root: string) {
  console.log(`\n${pc.green("Installing dependencies...")}`);
  try {
    execSync("bun install", { cwd: root, stdio: "inherit" });
  } catch (e) {
    console.warn(
      pc.yellow(
        "Failed to install dependencies. Please run 'bun install' manually."
      )
    );
  }
}

export function initGit(root: string) {
  try {
    execSync("git init", { cwd: root, stdio: "ignore" });
    fs.writeFileSync(
      path.join(root, ".gitignore"),
      "node_modules\ndist\n.env\n"
    );
    console.log(`✔ Initialized Git repository.`);
  } catch (e) {
    // ignore
  }
}

export const banner = `
${pc.cyan(`
  _      _    _               
 | |    | |  | |              
 | |__  | | _| | __ _ _ __    
 | '_ \\ | |/ / |/ _\` | '__|   
 | |_) ||   <| | (_| | |      
 |_.__/ |_|\\_\\_|\\__,_|_| v2.0 🐰
`)}
`;
