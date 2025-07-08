# create-bklar 🐰

[![NPM Version](https://img.shields.io/npm/v/create-bklar.svg)](https://www.npmjs.com/package/create-bklar)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

The official command-line tool to bootstrap a new **[bklar](https://www.npmjs.com/package/bklar)** project.

This package allows you to quickly scaffold a new application with a sensible project structure and all the necessary boilerplate, so you can start building your API in minutes.

---

## 🚀 Usage

The recommended way to use this tool is via `bun create`, which is Bun's built-in command for project scaffolding. You don't need to install this package globally.

Make sure you have [Bun](https://bun.sh/) installed, then run:

```bash
bun create bklar my-awesome-app
```

This single command will:

1.  Create a new directory named `my-awesome-app`.
2.  Scaffold a starter project with a basic server, `package.json`, and TypeScript configuration.
3.  Provide you with the next steps to get your server running.

### Interactive Mode

If you prefer, you can run the command without specifying a project name to enter an interactive mode:

```bash
bun create bklar
```

The tool will then prompt you for the project name.

### Next Steps

After the scaffolding is complete, follow the instructions to start your development server:

```bash
cd my-awesome-app
bun install
bun run dev
```

Your new bklar application will be running at `http://localhost:3000`.

## 📦 What's Included?

The generated project includes:

- A minimal `bklar` server setup in `index.ts`.
- A `package.json` with `bklar` as a dependency and a `dev` script.
- A pre-configured `tsconfig.json` for a modern Bun project.
- A standard `.gitignore` file.

## 🤝 Contributing

This package is part of the main `bklar` repository. Contributions are welcome! Please open an [issue](https://github.com/[your-username]/[your-repository]/issues) or submit a Pull Request.

## 📄 License

This project is licensed under the **MIT License**.
