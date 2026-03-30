import { NextResponse } from "next/server"

export async function GET() {
    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>POW Developer API v1</title>
        <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.0.0/swagger-ui.css" />
        <style>
            body { margin: 0; padding: 0; background: #000; }
            .swagger-ui { filter: invert(0.9) hue-rotate(180deg); } /* Quick dark mode */
            .swagger-ui .topbar { display: none; }
        </style>
    </head>
    <body>
        <div id="swagger-ui"></div>
        <script src="https://unpkg.com/swagger-ui-dist@5.0.0/swagger-ui-bundle.js" crossorigin></script>
        <script>
            window.onload = () => {
                window.ui = SwaggerUIBundle({
                    url: "/api/swagger.json",
                    dom_id: '#swagger-ui',
                    deepLinking: true,
                    presets: [
                        SwaggerUIBundle.presets.apis,
                        SwaggerUIBundle.SwaggerUIStandalonePreset
                    ],
                });
            };
        </script>
    </body>
    </html>
    `
    return new NextResponse(html, { headers: { "Content-Type": "text/html" } })
}
