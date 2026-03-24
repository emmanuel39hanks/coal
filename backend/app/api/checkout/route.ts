import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

const LEGACY_ROUTE = '/api/checkout';
const CANONICAL_ROUTE = '/api/checkouts';

function legacyHeaders() {
    const headers = new Headers();
    headers.set('Deprecation', 'true');
    headers.set('Link', `<${CANONICAL_ROUTE}>; rel="canonical"`);
    return headers;
}

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({}));

        if (body && typeof body === 'object' && 'splits' in body && body.splits) {
            return NextResponse.json(
                {
                    error: {
                        code: 'LEGACY_FIELD_UNSUPPORTED',
                        message: `Legacy ${LEGACY_ROUTE} no longer accepts inline splits. Use ${CANONICAL_ROUTE} with splitConfigId instead.`,
                    },
                },
                { status: 410, headers: legacyHeaders() },
            );
        }

        const payload = {
            amount: body.amount,
            currency: body.currency,
            productId: body.productId,
            productName: body.productName,
            productDescription: body.productDescription,
            productImage: body.productImage,
            description: body.description,
            redirectUrl: body.redirectUrl,
            callbackUrl: body.callbackUrl,
            splitConfigId: body.splitConfigId,
        };

        const forwardedHeaders = new Headers(request.headers);
        forwardedHeaders.delete('content-length');
        forwardedHeaders.delete('host');
        forwardedHeaders.delete('connection');
        forwardedHeaders.delete('accept-encoding');

        const upstream = await fetch(new URL(CANONICAL_ROUTE, request.url), {
            method: 'POST',
            headers: forwardedHeaders,
            body: JSON.stringify(payload),
        });

        const responseHeaders = new Headers(upstream.headers);
        responseHeaders.set('Deprecation', 'true');
        responseHeaders.set('Link', `<${CANONICAL_ROUTE}>; rel="canonical"`);

        return new NextResponse(await upstream.text(), {
            status: upstream.status,
            headers: responseHeaders,
        });
    } catch (error) {
        logger.error({ err: error }, 'Legacy checkout compatibility error');
        return NextResponse.json(
            {
                error: {
                    code: 'LEGACY_COMPATIBILITY_ERROR',
                    message: `Legacy ${LEGACY_ROUTE} failed. Please use ${CANONICAL_ROUTE}.`,
                },
            },
            { status: 500, headers: legacyHeaders() },
        );
    }
}
