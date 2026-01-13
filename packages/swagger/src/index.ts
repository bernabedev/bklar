import type { BklarInstance } from "bklar";
import type {
  ComponentsObject,
  SecurityRequirementObject,
} from "openapi3-ts/oas31";
import { getAbsoluteFSPath } from "swagger-ui-dist";
import { generateOpenAPI } from "./openapi-generator";
import { getScalarHTML, getSwaggerHTML } from "./ui";

export interface SwaggerOptions {
  /**
   * The base path for documentation.
   * @default "/docs"
   */
  path?: string;
  /**
   * Add global bearer authentication to the API documentation.
   * @default false
   */
  bearerAuth?: boolean;
  /**
   * If true, prints the documentation URLs to the console on startup.
   * @default false
   */
  verbose?: boolean;
  /**
   * OpenAPI specific configuration.
   */
  openapi?: {
    title?: string;
    version?: string;
    description?: string;
    components?: ComponentsObject;
    security?: SecurityRequirementObject[];
  };
  /**
   * UI Configuration settings.
   */
  ui?: {
    /** Enable/Disable Swagger UI. Default: true */
    swagger?: boolean;
    /** Enable/Disable Scalar UI. Default: true */
    scalar?: boolean;
    /** Scalar UI specific options */
    scalarConfig?: {
      theme?: "default" | "alternate" | "moon" | "purple" | "solarized";
    };
  };
}

export function swagger(options: SwaggerOptions = {}) {
  const config = {
    path: options.path || "/docs",
    verbose: options.verbose ?? false,
    openapi: options.openapi || {},
    ui: {
      swagger: options.ui?.swagger ?? true,
      scalar: options.ui?.scalar ?? true,
      scalarConfig: options.ui?.scalarConfig,
    },
  };

  // Configure Global Bearer Auth
  if (options.bearerAuth) {
    config.openapi.components = config.openapi.components || {};
    config.openapi.components.securitySchemes =
      config.openapi.components.securitySchemes || {};

    config.openapi.components.securitySchemes.bearerAuth = {
      type: "http",
      scheme: "bearer",
      bearerFormat: "JWT",
      description: "Enter your JWT in the format: Bearer <token>",
    };

    config.openapi.security = config.openapi.security || [];
    config.openapi.security.push({ bearerAuth: [] });
  }

  const _generateSpec = (app: BklarInstance) => {
    return generateOpenAPI(app, config.openapi);
  };

  const setup = (app: BklarInstance) => {
    const openApiSpec = _generateSpec(app);

    const jsonPath = `${config.path}/json`;
    const swaggerPath = `${config.path}/swagger`;
    const scalarPath = `${config.path}/scalar`;

    // 1. Serve the JSON Spec
    app.get(jsonPath, (ctx) => ctx.json(openApiSpec));

    // 2. Serve Swagger UI
    if (config.ui.swagger) {
      const assetsPath = getAbsoluteFSPath();

      // Serve UI HTML
      app.get(
        swaggerPath,
        () =>
          new Response(getSwaggerHTML(jsonPath), {
            headers: { "Content-Type": "text/html" },
          })
      );

      // Serve Static Assets
      app.get(
        `${config.path}/swagger-ui.css`,
        () => new Response(Bun.file(`${assetsPath}/swagger-ui.css`))
      );
      app.get(
        `${config.path}/swagger-ui-bundle.js`,
        () => new Response(Bun.file(`${assetsPath}/swagger-ui-bundle.js`))
      );
    }

    // 3. Serve Scalar UI
    if (config.ui.scalar) {
      app.get(
        scalarPath,
        () =>
          new Response(getScalarHTML(jsonPath, config.ui.scalarConfig), {
            headers: { "Content-Type": "text/html" },
          })
      );
    }

    // Log available routes
    if (config.verbose && (config.ui.swagger || config.ui.scalar)) {
      const PORT = process.env.PORT || 3000;
      console.log(`[bklar-swagger] 📖 Documentation ready:`);
      if (config.ui.swagger)
        console.log(`  ➜ Swagger: http://localhost:${PORT}${swaggerPath}`);
      if (config.ui.scalar)
        console.log(`  ➜ Scalar:  http://localhost:${PORT}${scalarPath}`);
      console.log(`  ➜ JSON:    http://localhost:${PORT}${jsonPath}`);
    }
  };

  return { setup, _generateSpec };
}
