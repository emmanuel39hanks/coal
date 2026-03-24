import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const specUrl = `${origin}/api/docs`;

  const html = `<!doctype html>
<html>
  <head>
    <title>Coal API Playground</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css" />
    <style>
      :root {
        color-scheme: light;
        --coal-bg: #f6f3ee;
        --coal-surface: #ffffff;
        --coal-surface-muted: #f8f7f4;
        --coal-border: #e6e0d6;
        --coal-text: #12263a;
        --coal-text-muted: #6f6a62;
        --coal-accent: #ff5c16;
        --coal-shadow: 0 18px 40px rgba(18, 38, 58, 0.08);
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        background:
          radial-gradient(circle at top left, rgba(255, 92, 22, 0.12), transparent 28%),
          linear-gradient(180deg, #fcfbf8 0%, var(--coal-bg) 100%);
        color: var(--coal-text);
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      .shell {
        width: min(1320px, calc(100vw - 32px));
        margin: 0 auto;
        padding: 28px 0 48px;
      }

      .hero {
        display: grid;
        gap: 18px;
        margin-bottom: 22px;
      }

      .hero-card {
        background: rgba(255, 255, 255, 0.9);
        border: 1px solid rgba(18, 38, 58, 0.08);
        border-radius: 28px;
        box-shadow: var(--coal-shadow);
        padding: 26px;
        backdrop-filter: blur(10px);
      }

      .eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        border-radius: 999px;
        background: rgba(255, 92, 22, 0.08);
        color: var(--coal-accent);
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      h1 {
        margin: 18px 0 10px;
        font-size: clamp(2rem, 4vw, 3.4rem);
        line-height: 0.96;
        letter-spacing: -0.05em;
      }

      .hero-copy {
        max-width: 760px;
        color: var(--coal-text-muted);
        font-size: 16px;
        line-height: 1.7;
      }

      .meta-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 14px;
      }

      .meta-card {
        border-radius: 22px;
        border: 1px solid var(--coal-border);
        background: var(--coal-surface-muted);
        padding: 16px 18px;
      }

      .meta-card h2 {
        margin: 0 0 6px;
        font-size: 13px;
        font-weight: 800;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--coal-text-muted);
      }

      .meta-card p,
      .meta-card code {
        margin: 0;
        font-size: 14px;
        line-height: 1.6;
      }

      .meta-card code {
        display: inline-block;
        margin-top: 4px;
        padding: 6px 10px;
        border-radius: 999px;
        background: white;
        border: 1px solid var(--coal-border);
      }

      #swagger-ui {
        background: transparent;
      }

      .swagger-ui {
        color: var(--coal-text);
      }

      .swagger-ui .topbar {
        display: none;
      }

      .swagger-ui .scheme-container {
        box-shadow: none;
        background: transparent;
        padding: 0;
        margin: 0 0 20px;
      }

      .swagger-ui .information-container,
      .swagger-ui .wrapper {
        padding: 0;
      }

      .swagger-ui .info {
        margin: 0 0 24px;
        padding: 0;
      }

      .swagger-ui .info .title,
      .swagger-ui .info .description,
      .swagger-ui .info a,
      .swagger-ui .info p,
      .swagger-ui .info li,
      .swagger-ui .opblock-description-wrapper p,
      .swagger-ui .response-col_description__inner p {
        color: var(--coal-text);
      }

      .swagger-ui .info .title small {
        background: rgba(255, 92, 22, 0.12);
        color: var(--coal-accent);
      }

      .swagger-ui .opblock-tag {
        border-bottom: 0;
        margin: 24px 0 12px;
        padding: 0;
        font-size: 18px;
        color: var(--coal-text);
      }

      .swagger-ui .opblock {
        margin: 0 0 14px;
        border: 1px solid var(--coal-border) !important;
        border-radius: 24px !important;
        background: var(--coal-surface) !important;
        box-shadow: var(--coal-shadow);
        overflow: hidden;
      }

      .swagger-ui .opblock::before {
        display: none !important;
      }

      .swagger-ui .opblock.opblock-get,
      .swagger-ui .opblock.opblock-post,
      .swagger-ui .opblock.opblock-put,
      .swagger-ui .opblock.opblock-delete,
      .swagger-ui .opblock.opblock-patch {
        background: var(--coal-surface) !important;
        border-color: var(--coal-border) !important;
      }

      .swagger-ui .opblock .opblock-summary {
        border-left: 0 !important;
        padding: 14px 18px;
        align-items: center;
        box-shadow: none !important;
      }

      .swagger-ui .opblock .opblock-summary-method {
        border-radius: 999px;
        min-width: 78px;
        font-weight: 800;
      }

      .swagger-ui .opblock .opblock-summary-path,
      .swagger-ui .opblock .opblock-summary-description,
      .swagger-ui .tab li,
      .swagger-ui label,
      .swagger-ui .parameter__name,
      .swagger-ui .responses-inner h4,
      .swagger-ui .responses-inner h5 {
        color: var(--coal-text);
      }

      .swagger-ui .opblock-body,
      .swagger-ui .model-box,
      .swagger-ui .responses-inner,
      .swagger-ui .parameters-container,
      .swagger-ui .execute-wrapper,
      .swagger-ui .opblock-section-header,
      .swagger-ui .response-col_links,
      .swagger-ui table tbody tr td,
      .swagger-ui table tbody tr th {
        background: transparent !important;
      }

      .swagger-ui .opblock-section-header {
        box-shadow: none;
        border-top: 1px solid rgba(18, 38, 58, 0.06);
      }

      .swagger-ui .btn.authorize,
      .swagger-ui .btn.execute {
        border-radius: 999px;
        border: 0;
        box-shadow: none;
      }

      .swagger-ui .btn.authorize {
        background: rgba(255, 92, 22, 0.1);
        color: var(--coal-accent);
      }

      .swagger-ui .btn.execute {
        background: var(--coal-accent);
      }

      .swagger-ui .servers,
      .swagger-ui .auth-wrapper {
        border-radius: 20px;
        border: 1px solid var(--coal-border);
        background: rgba(255, 255, 255, 0.82);
        padding: 12px 14px;
      }

      .swagger-ui select,
      .swagger-ui input[type="text"],
      .swagger-ui input[type="password"],
      .swagger-ui textarea {
        border-radius: 14px !important;
        border: 1px solid var(--coal-border) !important;
      }

      @media (max-width: 900px) {
        .shell {
          width: min(100vw - 20px, 1320px);
          padding-top: 18px;
        }

        .hero-card {
          border-radius: 22px;
          padding: 20px;
        }

        .swagger-ui .opblock .opblock-summary {
          padding: 12px 14px;
        }
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <div id="swagger-ui"></div>
    </main>
    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-standalone-preset.js"></script>
    <script>
      window.onload = () => {
        window.ui = SwaggerUIBundle({
          url: ${JSON.stringify(specUrl)},
          dom_id: '#swagger-ui',
          deepLinking: true,
          displayRequestDuration: true,
          docExpansion: 'list',
          filter: true,
          persistAuthorization: true,
          showExtensions: true,
          showCommonExtensions: true,
          defaultModelsExpandDepth: 1,
          defaultModelExpandDepth: 2,
          tryItOutEnabled: true,
          presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
          layout: 'BaseLayout',
          requestInterceptor: (request) => {
            request.headers['X-Requested-With'] = 'CoalDocsPlayground';
            return request;
          },
        });
      };
    </script>
  </body>
</html>`;
  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html',
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
        "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
        "img-src 'self' data: https:",
        "font-src 'self' data: https://cdn.jsdelivr.net",
        "connect-src 'self' https:",
        "frame-ancestors 'none'",
      ].join('; '),
    },
  });
}
