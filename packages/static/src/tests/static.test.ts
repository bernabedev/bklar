import { Bklar } from "bklar";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import fs from "node:fs/promises";
import path from "node:path";
import { staticFiles } from "..";

// Define a temporary directory for our static files
const tempPublicDir = path.join(import.meta.dir, "test-public");

describe("Static Middleware", () => {
  let app: ReturnType<typeof Bklar>;

  // Setup: Create the temp directory and files before each test
  beforeEach(async () => {
    app = Bklar({ logger: false });

    // Create a temporary public directory
    await fs.mkdir(tempPublicDir, { recursive: true });

    // Create a dummy text file
    await fs.writeFile(
      path.join(tempPublicDir, "index.html"),
      "<h1>Hello World</h1>"
    );

    // Create a subfolder file
    await fs.mkdir(path.join(tempPublicDir, "assets"), { recursive: true });
    await fs.writeFile(
      path.join(tempPublicDir, "assets/style.css"),
      "body { color: red; }"
    );

    // Create a dotfile to test security
    await fs.writeFile(path.join(tempPublicDir, ".secret"), "dont-read-me");
  });

  // Teardown: Remove the temp directory after each test
  afterEach(async () => {
    await fs.rm(tempPublicDir, { recursive: true, force: true });
  });

  it("should serve a static HTML file", async () => {
    app.use(staticFiles({ root: tempPublicDir }));

    const res = await app.request("/index.html");

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toStartWith("text/html");
    const text = await res.text();
    expect(text).toBe("<h1>Hello World</h1>");
  });

  it("should serve files from subdirectories", async () => {
    app.use(staticFiles({ root: tempPublicDir }));

    const res = await app.request("/assets/style.css");

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toStartWith("text/css");
    expect(await res.text()).toBe("body { color: red; }");
  });

  it("should correctly serve files when using a prefix", async () => {
    app.use(staticFiles({ root: tempPublicDir, prefix: "/static" }));

    const res = await app.request("/static/index.html");

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("<h1>Hello World</h1>");
  });

  it("should pass through if prefix does not match", async () => {
    app.use(staticFiles({ root: tempPublicDir, prefix: "/static" }));

    // Add a fallback route
    app.get("/api/data", (ctx) => ctx.json({ data: "api" }));

    const res = await app.request("/api/data");

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toBe("api");
  });

  it("should pass through (404) for a file that does not exist", async () => {
    app.use(staticFiles({ root: tempPublicDir }));

    const res = await app.request("/not-found.txt");

    // bklar's default 404 handler should be triggered because staticFiles calls next()
    expect(res.status).toBe(404);
  });

  it("should not serve dotfiles by default", async () => {
    app.use(staticFiles({ root: tempPublicDir }));

    const res = await app.request("/.secret");

    // It should call next() and result in 404
    expect(res.status).toBe(404);
  });

  it("should serve dotfiles when the option is enabled", async () => {
    app.use(staticFiles({ root: tempPublicDir, dotfiles: true }));

    const res = await app.request("/.secret");

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("dont-read-me");
  });

  it("should prevent directory traversal attacks", async () => {
    app.use(staticFiles({ root: tempPublicDir }));

    // An attacker might try to access a file outside the public directory
    // Bun's Request handler or path normalization usually catches this,
    // but the middleware logic explicitly checks for it.
    const res = await app.request("/../../../../package.json");

    expect(res.status).toBe(404);
  });
});
