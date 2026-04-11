/**
 * Proxy route: /api/coal/publish-catalog
 *
 * Client-side <CoalAgentPublisher> components POST the local catalog here.
 * This route runs on the merchant's own server and internally calls
 * publishCoalCatalog() from coal-react/server using the server-side Coal API
 * key. The API key NEVER leaves the server.
 *
 * This is the recommended pattern for any merchant shipping
 * <CoalAgentPublisher> in a public-facing Next.js app.
 */

import { publishCoalCatalog, CoalPublishError } from 'coal-react/server';

const MERCHANT_ID =
    process.env.NEXT_PUBLIC_COAL_MERCHANT_ID || 'lst00PqEWRwcM4roiOcSpD8WfxlBc2hH';
const COAL_API_KEY = process.env.COAL_API_KEY || '';
const COAL_API_URL = process.env.NEXT_PUBLIC_COAL_API_URL || 'https://api.usecoal.xyz';

export async function POST(request: Request) {
    if (!COAL_API_KEY) {
        return new Response(
            JSON.stringify({
                error: {
                    code: 'NOT_CONFIGURED',
                    message:
                        'Set COAL_API_KEY on the server to enable catalog publishing.',
                },
            }),
            { status: 501, headers: { 'content-type': 'application/json' } },
        );
    }

    let body: { products?: unknown; mode?: 'upsert' | 'replace' };
    try {
        body = await request.json();
    } catch {
        return new Response(
            JSON.stringify({ error: { code: 'INVALID_JSON', message: 'Invalid JSON body' } }),
            { status: 400, headers: { 'content-type': 'application/json' } },
        );
    }

    if (!Array.isArray(body.products)) {
        return new Response(
            JSON.stringify({
                error: { code: 'INVALID_BODY', message: 'products must be an array' },
            }),
            { status: 400, headers: { 'content-type': 'application/json' } },
        );
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
        return new Response(
            JSON.stringify({ error: { code: 'INTERNAL', message } }),
            { status: 500, headers: { 'content-type': 'application/json' } },
        );
    }
}
