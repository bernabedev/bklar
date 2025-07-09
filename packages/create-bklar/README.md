# create-bklar 🐰

[![NPM Version](https://img.shields.io/npm/v/create-bklar.svg)](https://www.npmjs.com/package/create-bklar)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

The official command-line tool to bootstrap a new **[bklar](https://www.npmjs.com/package/bklar)** project.

This package allows you to quickly scaffold a new application with a sensible project structure and all the necessary boilerplate, so you can start building your API in minutes.

---

## 🚀 Usage

The recommended way to use this tool is via `bun create`, which is Bun's built-in command for project scaffolding. You don't need to install this package globally.

Make sure you have [Bun](https://bun.sh/) installed, then run the following command:

```bash
bun create bklar
```

This will launch an interactive setup wizard that guides you through the process of creating your new project.

### The Setup Wizard

The wizard will ask you a few questions to customize your project:

1.  **Project Name:** The name of your new application directory.
2.  **Project Template:** Choose a starting point for your project.

You can choose from one of three templates:

- **Minimal:** A blank slate. Just the bare essentials to get you started.
- **REST API Starter:** A pre-configured setup that includes common plugins like CORS, JWT, and Rate Limiting. Perfect for quickly building a production-ready API.
- **Custom:** Gives you full control to choose exactly which official plugins you want to include in your project.

After setting up your project, the tool will also offer to initialize a Git repository and install dependencies for you.

### Non-Interactive Mode

If you want to skip the interactive prompts, you can pass the project name as an argument. The tool will then scaffold a project using the default **Minimal** template.

```bash
bun create bklar my-awesome-app
```

### Next Steps

After the scaffolding is complete, follow the on-screen instructions to start your development server:

```bash
cd my-awesome-app
bun install
bun run dev
```

Your new bklar application will be running at `http://localhost:3000`.

## 📦 What's Included?

Depending on your choices, the generated project will include:

- A minimal `bklar` server setup in `index.ts`.
- A `package.json` with `bklar` and any selected plugins as dependencies.
- A pre-configured `tsconfig.json` for a modern Bun project.
- A standard `.gitignore` file.
- An initialized Git repository (optional).

## 🤝 Contributing

This package is part of the main `bklar` repository. Contributions are welcome! Please open an [issue](https://github.com/bernabedev/bklar/issues) or submit a Pull Request.

## 📄 License

This project is licensed under the **MIT License**.

---

### Key Improvements in This README:

1.  **Focus on Interactivity:** The `Usage` section now highlights the interactive wizard (`bun create bklar`) as the primary way to use the tool, as it's the most powerful feature.
2.  **Showcases Templates:** It clearly explains the three available templates (`Minimal`, `REST API Starter`, `Custom`), helping users understand their options immediately.
3.  **Explains Non-Interactive Mode:** It still documents the non-interactive mode (`bun create bklar my-app`) but clarifies that it uses the default template.
4.  **Updated `What's Included?` Section:** This section is now more dynamic, mentioning that the contents depend on the user's choices.
5.  **Clarity and Flow:** The overall structure is designed to guide the user from the simplest command to understanding the powerful customization options available.
