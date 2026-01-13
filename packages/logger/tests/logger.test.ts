import { describe, expect, it, spyOn } from "bun:test";
import { Bklar } from "bklar";
import { logger, Logger } from "../src/index";

describe("Logger System", () => {
  it("should redact sensitive keys", () => {
    let output = "";
    const logger = new Logger({
      format: "json",
      stream: (msg) => {
        output = msg as string;
      },
    });

    logger.info(
      {
        password: "secret123",
        user: { token: "abc", name: "john" },
      },
      "login"
    );

    const parsed = JSON.parse(output);
    expect(parsed.password).toBe("[REDACTED]");
    expect(parsed.user.token).toBe("[REDACTED]");
    expect(parsed.user.name).toBe("john");
  });

  it("should inject logger and reqId into context", async () => {
    const app = Bklar({ logger: false });
    app.use(logger({ pretty: false }));

    app.get("/", (ctx) => {
      expect(ctx.reqId).toBeDefined();
      expect(ctx.logger).toBeDefined();

      // Should handle child logging
      ctx.logger.info("Inside handler");

      return ctx.text("ok");
    });

    // Mock console to keep test clean
    const spy = spyOn(console, "log").mockImplementation(() => {});
    await app.request("/");
    spy.mockRestore();
  });

  it("should log request completion with correct status level", async () => {
    let logs: any[] = [];
    const stream = (msg: any) => logs.push(JSON.parse(msg));

    const app = Bklar({ logger: false });
    app.use(logger({ format: "json", stream }));

    app.get("/ok", (ctx) => ctx.text("ok")); // 200
    app.get("/bad", (ctx) => ctx.status(400)); // 400
    app.get("/err", (ctx) => ctx.status(500)); // 500

    await app.request("/ok");
    await app.request("/bad");
    await app.request("/err");

    expect(logs[0].level).toBe("info");
    expect(logs[0].msg).toBe("Request Completed");

    expect(logs[1].level).toBe("warn");
    expect(logs[1].msg).toBe("Client Error");

    expect(logs[2].level).toBe("error");
    expect(logs[2].msg).toBe("Request Failed");
  });
});
