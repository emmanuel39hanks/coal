import { NextResponse } from 'next/server';
import { errors, apiSuccess } from '@/lib/errors';
import { rateLimiters, checkRateLimit, getIP } from '@/lib/rate-limit';
import { getPaywallVerificationState } from '@/lib/paywall-verification';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const ip = getIP(request);
        const { limited, headers: rlHeaders } = await checkRateLimit(rateLimiters.public, ip);
        if (limited) return errors.rateLimited();

        const { id } = await params;
        const url = new URL(request.url);
        const address = url.searchParams.get('address') ?? undefined;

        const verification = await getPaywallVerificationState({ paywallId: id, address });
        if (!verification) return errors.notFound('Paywall');

        if (verification.paid) {
            return apiSuccess(verification.body, 200);
        }

        return NextResponse.json(verification.body, {
            status: 402,
            headers: {
                ...rlHeaders,
                'X-Payment-Required': 'true',
                'X-Price': `${verification.body.price} ${verification.body.currency}`,
            },
        });
    } catch {
        return errors.internal();
    }
}
