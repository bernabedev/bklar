import { Bklar as createApp } from "bklar";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import fs from "fs/promises";
import path from "path";
import { staticServer } from "..";

// Define a temporary directory for our static files
const tempPublicDir = path.join(import.meta.dir, "test-public");

describe("@bklarjs/static Middleware Tests", () => {
  let app: ReturnType<typeof createApp>;

  // Setup: Create the temp directory and files before each test
  beforeEach(async () => {
    app = createApp({ logger: false }); // Disable logger for clean test output

    // Create a temporary public directory
    await fs.mkdir(tempPublicDir, { recursive: true });

    // Create a dummy text file
    await fs.writeFile(
      path.join(tempPublicDir, "index.html"),
      "<h1>Hello World</h1>"
    );

    // Create a dummy image file (a simple 1x1 PNG buffer)
    const pngBuffer = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
      "base64"
    );
    await fs.writeFile(path.join(tempPublicDir, "assets/logo.png"), pngBuffer);

    // Create a dotfile to test security
    await fs.writeFile(path.join(tempPublicDir, ".secret"), "dont-read-me");
  });

  // Teardown: Remove the temp directory after each test
  afterEach(async () => {
    await fs.rm(tempPublicDir, { recursive: true, force: true });
  });

  it("should serve a static HTML file from the root", async () => {
    app.use(staticServer({ root: tempPublicDir }));

    const req = new Request("http://localhost/index.html");
    const res = await app.router.handle(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toStartWith("text/html");
    const text = await res.text();
    expect(text).toBe("<h1>Hello World</h1>");
  });

  it("should serve a static image file with the correct content type", async () => {
    app.use(staticServer({ root: tempPublicDir }));

    const req = new Request("http://localhost/assets/logo.png");
    const res = await app.router.handle(req);

    expect(res.status).toBe(200);
    // Bun.file automatically sets the correct content type
    expect(res.headers.get("Content-Type")).toBe("image/png");

    // We can also verify the content length to be sure
    const buffer = await res.arrayBuffer();
    expect(buffer.byteLength).toBe(68); // Size of the 1x1 PNG buffer
  });

  it("should correctly serve files when using a prefix", async () => {
    app.use(staticServer({ root: tempPublicDir, prefix: "/static" }));

    // Request with the prefix
    const req = new Request("http://localhost/static/index.html");
    const res = await app.router.handle(req);

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe("<h1>Hello World</h1>");
  });

  it("should not serve a file if the request does not match the prefix", async () => {
    app.use(staticServer({ root: tempPublicDir, prefix: "/static" }));
    app.get("/api/data", (ctx) => ctx.json({ data: "api" })); // An API route

    const req = new Request("http://localhost/api/data"); // Doesn't match '/static'
    const res = await app.router.handle(req);

    // It should fall through to the API route handler
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toBe("api");
  });

  it("should return 404 for a file that does not exist", async () => {
    app.use(staticServer({ root: tempPublicDir }));

    const req = new Request("http://localhost/not-found.txt");
    const res = await app.router.handle(req);

    // bklar's default 404 handler should be triggered
    expect(res.status).toBe(404);
  });

  it("should not serve dotfiles by default", async () => {
    app.use(staticServer({ root: tempPublicDir }));

    const req = new Request("http://localhost/.secret");
    const res = await app.router.handle(req);

    // It should fall through and result in a 404, not serve the file.
    expect(res.status).toBe(404);
  });

  it("should serve dotfiles when the option is enabled", async () => {
    app.use(staticServer({ root: tempPublicDir, dotfiles: true }));

    const req = new Request("http://localhost/.secret");
    const res = await app.router.handle(req);

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe("dont-read-me");
  });

  it("should prevent directory traversal attacks", async () => {
    app.use(staticServer({ root: tempPublicDir }));

    // An attacker might try to access a file outside the public directory
    const req = new Request("http://localhost/../../../../package.json");
    const res = await app.router.handle(req);

    // The middleware should ignore this request, leading to a 404.
    expect(res.status).toBe(404);
  });
});
