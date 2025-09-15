import { Bklar } from "bklar";
import { describe, expect, it } from "bun:test";
import { z } from "zod/v4";
import { swagger } from "../index";

describe("@bklarjs/swagger Package Tests", () => {
  it("should generate a basic OpenAPI spec with correct info", () => {
    const app = Bklar({ logger: false });
    const generator = swagger({
      openapi: {
        title: "Test API",
        version: "1.0.0",
        description: "An API for testing purposes",
      },
    });

    // We get the OpenAPI spec by calling the generator's internal function
    // This avoids setting up real routes for a simple info test.
    const spec = generator._generateSpec(app);

    expect(spec.openapi).toBe("3.1.0");
    expect(spec.info.title).toBe("Test API");
    expect(spec.info.version).toBe("1.0.0");
    expect(spec.info.description).toBe("An API for testing purposes");
  });

  it("should generate correct paths and methods for simple routes", () => {
    const app = Bklar({ logger: false });
    app.get("/users", (ctx) => ctx.json([]));
    app.post("/users", (ctx) => ctx.json({}));

    const generator = swagger();
    const spec = (generator as any)._generateSpec(app);

    expect(spec.paths?.["/users"]).toBeDefined();
    expect(spec.paths?.["/users"].get).toBeDefined();
    expect(spec.paths?.["/users"].post).toBeDefined();
  });

  it("should convert Zod schemas for path and query parameters", () => {
    const app = Bklar({ logger: false });
    app.get("/users/:id", (ctx) => ctx.json({}), {
      schemas: {
        params: z.object({ id: z.coerce.number().int() }),
        query: z.object({ format: z.enum(["json", "xml"]).optional() }),
      },
    });

    const generator = swagger();
    const spec = (generator as any)._generateSpec(app);

    const operation = spec.paths["/users/{id}"].get;
    expect(operation.parameters).toHaveLength(2);

    const pathParam = operation.parameters.find((p: any) => p.in === "path");
    expect(pathParam.name).toBe("id");
    expect(pathParam.required).toBe(true);
    expect(pathParam.schema.type).toBe("integer");

    const queryParam = operation.parameters.find((p: any) => p.in === "query");
    expect(queryParam.name).toBe("format");
    expect(queryParam.required).toBe(false || undefined); // Because it's optional
    expect(queryParam.schema.enum).toEqual(["json", "xml"]);
  });

  it("should convert a Zod schema for a request body and create a component", () => {
    const app = Bklar({ logger: false });
    app.post("/users", (ctx) => ctx.json({}), {
      schemas: {
        body: z.object({ name: z.string(), email: z.string().email() }),
      },
    });

    const generator = swagger();
    const spec = (generator as any)._generateSpec(app);

    const requestBody = spec.paths["/users"].post.requestBody;
    expect(requestBody).toBeDefined();

    const schemaRef = requestBody.content["application/json"].schema.$ref;
    expect(schemaRef).toBe("#/components/schemas/POST_users_Body");

    const componentSchema = spec.components.schemas["POST_users_Body"];
    expect(componentSchema.type).toBe("object");
    expect(componentSchema.properties.name.type).toBe("string");
    expect(componentSchema.properties.email.format).toBe("email");
    expect(componentSchema.required).toContain("name");
    expect(componentSchema.required).toContain("email");
  });

  it("should convert a Zod schema for a response and create a component", () => {
    const app = Bklar({ logger: false });
    const userSchema = z.object({ id: z.number(), name: z.string() });

    app.get("/users/1", (ctx) => ctx.json({}), {
      doc: {
        responses: {
          "200": {
            description: "A single user.",
            content: {
              "application/json": { schema: userSchema },
            },
          },
        },
      },
    });

    const generator = swagger();
    const spec = (generator as any)._generateSpec(app);

    const response = spec.paths["/users/1"].get.responses["200"];
    expect(response).toBeDefined();

    const schemaRef = response.content["application/json"].schema.$ref;
    expect(schemaRef).toBe("#/components/schemas/GET_users_1_Response_200");

    const componentSchema = spec.components.schemas["GET_users_1_Response_200"];
    expect(componentSchema.type).toBe("object");
    expect(componentSchema.properties.id.type).toBe("number");
    expect(componentSchema.properties.name.type).toBe("string");
  });

  it("should correctly handle an array response schema", () => {
    const app = Bklar({ logger: false });
    const userSchema = z.object({ id: z.number(), name: z.string() });

    app.get("/users", (ctx) => ctx.json([]), {
      doc: {
        responses: {
          "200": {
            description: "A list of users.",
            content: {
              "application/json": { schema: z.array(userSchema) },
            },
          },
        },
      },
    });

    const generator = swagger();
    const spec = (generator as any)._generateSpec(app);

    const responseSchemaRef =
      spec.paths["/users"].get.responses["200"].content["application/json"]
        .schema.$ref;
    const responseSchema =
      spec.components.schemas[responseSchemaRef.split("/").pop()];

    expect(responseSchema.type).toBe("array");
    expect(responseSchema.items.type).toBe("object");
    expect(responseSchema.items.properties.name.type).toBe("string");
  });
  describe("Authentication Tests", () => {
    it("should add global bearerAuth security scheme when enabled", () => {
      const app = Bklar({ logger: false });
      const generator = swagger({ bearerAuth: true });
      const spec = generator._generateSpec(app);

      expect(spec.components?.securitySchemes?.bearerAuth).toBeDefined();
      expect(spec.components?.securitySchemes?.bearerAuth).toEqual({
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Enter your JWT in the format: Bearer <token>",
      });

      expect(spec.security).toBeDefined();
      expect(spec.security).toEqual([{ bearerAuth: [] }]);
    });

    it("should apply security to a specific route", () => {
      const app = Bklar({ logger: false });
      app.get("/profile", (ctx) => ctx.json({ user: "admin" }), {
        doc: {
          summary: "Get user profile",
          tags: ["Users"],
          security: [{ bearerAuth: [] }],
        },
      });

      // We enable bearerAuth globally so the scheme is defined
      const generator = swagger({ bearerAuth: true });
      const spec = generator._generateSpec(app);

      const operation = spec.paths?.["/profile"]?.get;
      expect(operation?.security).toBeDefined();
      expect(operation?.security).toEqual([{ bearerAuth: [] }]);
    });

    it("should allow a route to be public when global security is enabled", () => {
      const app = Bklar({ logger: false });
      app.get("/public", (ctx) => ctx.json({ status: "ok" }), {
        doc: {
          summary: "Public endpoint",
          security: [], // An empty array overrides global security
        },
      });

      const generator = swagger({ bearerAuth: true });
      const spec = generator._generateSpec(app);

      const operation = spec.paths?.["/public"]?.get;
      expect(operation?.security).toBeDefined();
      expect(operation?.security).toEqual([]); // Should be an empty array
    });
  });
});
