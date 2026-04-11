/**
 * Proxy route: /api/coal/publish-catalog
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  SECURITY WARNING — READ BEFORE SHIPPING                            │
 * ├─────────────────────────────────────────────────────────────────────┤
 * │                                                                     │
 * │  This route is called by <CoalAgentPublisher> in app/page.tsx and   │
 * │  forwards the request to Coal using the server-side COAL_API_KEY.   │
 * │  The Coal API key NEVER reaches the browser.                        │
 * │                                                                     │
 * │  Demo-grade auth: a shared secret in the x-coal-publish-secret      │
 * │  header is compared against COAL_PUBLISH_PROXY_SECRET. If either    │
 * │  env var is unset, the route refuses to serve (501). This keeps     │
 * │  drive-by attackers from pushing junk catalogs into Coal with your  │
 * │  API key while still letting a logged-in dev flip one env var to    │
 * │  run the demo locally.                                              │
 * │                                                                     │
 * │  Do NOT ship this pattern to a real production store as-is. A       │
 * │  NEXT_PUBLIC_ secret in the client bundle is security-through-      │
 * │  obscurity — anyone can read it from the compiled JS. For real      │
 * │  production, pick one of:                                           │
 * │                                                                     │
 * │    1. Session auth: only authenticated admins can POST here.        │
 * │    2. Signed CSRF token issued by the server on a fresh page load.  │
 * │    3. Don't expose a browser-triggered route at all — fire          │
 * │       publishCoalCatalog() from a DB webhook, CMS trigger, or       │
 * │       scheduled cron. The strongest pattern.                        │
 * │                                                                     │
 * │  This file exists to demo option 1's minimum viable shape.          │
 * └─────────────────────────────────────────────────────────────────────┘
 */

import { publishCoalCatalog, CoalPublishError } from "coal-react/server";

const MERCHANT_ID =
  process.env.NEXT_PUBLIC_COAL_MERCHANT_ID || "lst00PqEWRwcM4roiOcSpD8WfxlBc2hH";
const COAL_API_KEY = process.env.COAL_API_KEY || "";
const COAL_API_URL = process.env.NEXT_PUBLIC_COAL_API_URL || "https://api.usecoal.xyz";
const PROXY_SECRET = process.env.COAL_PUBLISH_PROXY_SECRET || "";

function jsonError(code: string, message: string, status: number): Response {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function POST(request: Request) {
  if (!COAL_API_KEY) {
    return jsonError(
      "NOT_CONFIGURED",
      "Set COAL_API_KEY on the server to enable catalog publishing.",
      501,
    );
  }
  if (!PROXY_SECRET) {
    return jsonError(
      "NOT_CONFIGURED",
      "Set COAL_PUBLISH_PROXY_SECRET on the server to enable the demo proxy.",
      501,
    );
  }

  const supplied = request.headers.get("x-coal-publish-secret") || "";
  if (supplied !== PROXY_SECRET) {
    return jsonError(
      "UNAUTHORIZED",
      "Missing or invalid x-coal-publish-secret header.",
      401,
    );
  }

  let body: { products?: unknown; mode?: "upsert" | "replace" };
  try {
    body = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "Invalid JSON body", 400);
  }
  if (!Array.isArray(body.products)) {
    return jsonError("INVALID_BODY", "products must be an array", 400);
  }

  try {
    const result = await publishCoalCatalog({
      merchantId: MERCHANT_ID,
      apiKey: COAL_API_KEY,
      apiUrl: COAL_API_URL,
      products: body.products as Parameters<typeof publishCoalCatalog>[0]["products"],
      mode: body.mode ?? "upsert",
    });
    return Response.json(result);
  } catch (err) {
    if (err instanceof CoalPublishError) {
      return new Response(
        JSON.stringify({
          error: { code: err.code, message: err.message, details: err.details },
        }),
        {
          status: err.status || 500,
          headers: { "content-type": "application/json" },
        },
      );
    }
    const message = err instanceof Error ? err.message : "Unknown server error";
    return jsonError("INTERNAL", message, 500);
  }
}
