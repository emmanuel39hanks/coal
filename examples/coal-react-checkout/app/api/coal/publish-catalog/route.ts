/**
 * Proxy route: /api/coal/publish-catalog
 *
 * Client-side <CoalAgentPublisher> components POST the local catalog here.
 * This route runs on the merchant's own server and internally calls
 * publishCoalCatalog() from coal-react/server using the server-side Coal
 * API key. The API key NEVER leaves the server.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  SECURITY WARNING — READ BEFORE COPYING TO PRODUCTION               │
 * ├─────────────────────────────────────────────────────────────────────┤
 * │                                                                     │
 * │  This proxy accepts POST requests from any origin by default.       │
 * │  For a demo app that's fine — the published products are mock data  │
 * │  and Coal's own 1-publish-per-minute rate limit caps the blast      │
 * │  radius.                                                            │
 * │                                                                     │
 * │  In production you MUST add one of these before shipping:           │
 * │                                                                     │
 * │   1. SESSION AUTH                                                   │
 * │      Require an authenticated admin session (merchant's own login)  │
 * │      before forwarding to Coal. Example with next-auth:             │
 * │                                                                     │
 * │        const session = await getServerSession();                    │
 * │        if (!session?.user?.isAdmin) return unauthorized();          │
 * │                                                                     │
 * │   2. CSRF TOKEN                                                     │
 * │      Generate a signed token in a cookie, verify it on POST.        │
 * │      Required for any browser-triggered mutation.                   │
 * │                                                                     │
 * │   3. SERVER-SIDE TRIGGERS ONLY                                      │
 * │      Skip the browser path entirely. Call publishCoalCatalog()      │
 * │      from a webhook fired by your DB (Prisma hook, Supabase         │
 * │      trigger, Shopify webhook, etc.) or a scheduled cron job.       │
 * │      This is the strongest pattern — there is no browser-facing    │
 * │      endpoint to attack.                                            │
 * │                                                                     │
 * │  THIS DEMO uses a lightweight shared-secret header to demonstrate   │
 * │  at least one layer of defense. The header is read from             │
 * │  COAL_PUBLISH_PROXY_SECRET and must be sent by                      │
 * │  <CoalAgentPublisher>'s proxyUrl consumer. If the env var is not    │
 * │  set, the route DISABLES itself with a 501 response (opt-in).       │
 * │                                                                     │
 * │  Without any of the three patterns above, a malicious visitor can   │
 * │  POST arbitrary products here → your API key forwards them to       │
 * │  Coal → your catalog gets polluted (rate-limited but still real).   │
 * │  With mode=replace, the attacker can deactivate your entire         │
 * │  externally-published catalog.                                      │
 * │                                                                     │
 * │  Treat this file like you would treat any mutating endpoint: add    │
 * │  auth.                                                              │
 * │                                                                     │
 * └─────────────────────────────────────────────────────────────────────┘
 */

import { publishCoalCatalog, CoalPublishError } from 'coal-react/server';

const MERCHANT_ID =
    process.env.NEXT_PUBLIC_COAL_MERCHANT_ID || 'lst00PqEWRwcM4roiOcSpD8WfxlBc2hH';
const COAL_API_KEY = process.env.COAL_API_KEY || '';
const COAL_API_URL = process.env.NEXT_PUBLIC_COAL_API_URL || 'https://api.usecoal.xyz';

// Demo-grade auth. See the warning block above — this is NOT a substitute for
// real session auth in production.
const PROXY_SECRET = process.env.COAL_PUBLISH_PROXY_SECRET || '';

function jsonError(code: string, message: string, status: number): Response {
    return new Response(JSON.stringify({ error: { code, message } }), {
        status,
        headers: { 'content-type': 'application/json' },
    });
}

export async function POST(request: Request) {
    if (!COAL_API_KEY) {
        return jsonError(
            'NOT_CONFIGURED',
            'Set COAL_API_KEY on the server to enable catalog publishing.',
            501,
        );
    }

    // Demo-grade shared-secret check. If COAL_PUBLISH_PROXY_SECRET is unset,
    // the route refuses to serve at all. If it is set, the incoming request
    // must carry the same value in x-coal-publish-secret.
    if (!PROXY_SECRET) {
        return jsonError(
            'NOT_CONFIGURED',
            'Set COAL_PUBLISH_PROXY_SECRET on the server to enable the demo ' +
                'proxy. Without it the route refuses requests to prevent open ' +
                'catalog publishing.',
            501,
        );
    }
    const suppliedSecret = request.headers.get('x-coal-publish-secret') || '';
    if (suppliedSecret !== PROXY_SECRET) {
        return jsonError(
            'UNAUTHORIZED',
            'Missing or invalid x-coal-publish-secret header.',
            401,
        );
    }

    let body: { products?: unknown; mode?: 'upsert' | 'replace' };
    try {
        body = await request.json();
    } catch {
        return jsonError('INVALID_JSON', 'Invalid JSON body', 400);
    }

    if (!Array.isArray(body.products)) {
        return jsonError('INVALID_BODY', 'products must be an array', 400);
    }

    try {
        const result = await publishCoalCatalog({
            merchantId: MERCHANT_ID,
            apiKey: COAL_API_KEY,
            apiUrl: COAL_API_URL,
            products: body.products as Parameters<typeof publishCoalCatalog>[0]['products'],
            mode: body.mode ?? 'upsert',
        });
        return Response.json(result);
    } catch (err) {
        if (err instanceof CoalPublishError) {
            return new Response(
                JSON.stringify({
                    error: {
                        code: err.code,
                        message: err.message,
                        details: err.details,
                    },
                }),
                { status: err.status || 500, headers: { 'content-type': 'application/json' } },
            );
        }
        const message = err instanceof Error ? err.message : 'Unknown server error';
        return jsonError('INTERNAL', message, 500);
    }
}
