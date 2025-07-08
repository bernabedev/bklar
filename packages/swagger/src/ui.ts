export function getSwaggerHTML(jsonUrl: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>bklar - Swagger UI</title>
        <link rel="stylesheet" type="text/css" href="./swagger-ui.css" />
      </head>
      <body>
        <div id="swagger-ui"></div>
        <script src="./swagger-ui-bundle.js"></script>
        <script>
          window.onload = function() {
            SwaggerUIBundle({
              url: "${jsonUrl}",
              dom_id: '#swagger-ui',
            })
          }
        </script>
      </body>
    </html>
  `;
}

export function getScalarHTML(jsonUrl: string): string {
  return `
    <!doctype html>
    <html>
      <head>
        <title>bklar - Scalar API Reference</title>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <script
          id="api-reference"
          data-url="${jsonUrl}"
        ></script>
        <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
      </body>
    </html>
  `;
}
