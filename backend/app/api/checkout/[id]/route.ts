import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

const CANONICAL_ROUTE = '/api/resolve/session';

function legacyHeaders() {
    const headers = new Headers();
    headers.set('Deprecation', 'true');
    headers.set('Link', `<${CANONICAL_ROUTE}>; rel="canonical"`);
    headers.set('Cache-Control', 'no-store');
    return headers;
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const upstream = await fetch(
            new URL(`${CANONICAL_ROUTE}?id=${encodeURIComponent(id)}`, request.url),
            {
                headers: {
                    accept: 'application/json',
                },
                cache: 'no-store',
            },
        );

        const headers = new Headers(upstream.headers);
        headers.set('Deprecation', 'true');
        headers.set('Link', `<${CANONICAL_ROUTE}>; rel="canonical"`);
        headers.set('Cache-Control', 'no-store');

        return new NextResponse(await upstream.text(), {
            status: upstream.status,
            headers,
        });
    } catch (error) {
        logger.error({ err: error }, 'Legacy checkout lookup compatibility error');
        return NextResponse.json(
            {
                error: {
                    code: 'LEGACY_COMPATIBILITY_ERROR',
                    message: `Legacy /api/checkout/[id] failed. Use ${CANONICAL_ROUTE}?id=... instead.`,
                },
            },
            { status: 500, headers: legacyHeaders() },
        );
    }
}
