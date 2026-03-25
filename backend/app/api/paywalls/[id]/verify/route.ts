import { NextResponse } from 'next/server';
import { errors, apiSuccess } from '@/lib/errors';
import { rateLimiters, checkRateLimit, getIP } from '@/lib/rate-limit';
import { getPaywallVerificationState } from '@/lib/paywall-verification';
import { buildX402Headers } from '@/lib/x402';

// H1: Validate paywall ID format before DB query
const VALID_ID_PATTERN = /^[a-z0-9]{20,36}$/;
// H2: Validate EVM address format
const VALID_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const ip = getIP(request);
        const { limited, headers: rlHeaders } = await checkRateLimit(rateLimiters.public, ip);
        if (limited) return errors.rateLimited();

        const { id } = await params;

        if (!VALID_ID_PATTERN.test(id)) {
            return errors.notFound('Paywall');
        }

        const url = new URL(request.url);
        const rawAddress = url.searchParams.get('address');
        const address = rawAddress && VALID_ADDRESS_PATTERN.test(rawAddress) ? rawAddress : undefined;

        const verification = await getPaywallVerificationState({ paywallId: id, address });
        if (!verification) return errors.notFound('Paywall');

        if (verification.paid) {
            return apiSuccess(verification.body, 200);
        }

        // Build x402-compliant headers so AI agents and x402 clients
        // can automatically discover payment requirements
        const x402Headers = buildX402Headers({
            id: verification.paywall.id,
            price: verification.paywall.price,
            currency: verification.paywall.currency,
            name: verification.paywall.name,
            description: verification.paywall.description,
            merchant: verification.paywall.merchant,
        });

        return NextResponse.json(verification.body, {
            status: 402,
            headers: {
                ...rlHeaders,
                ...x402Headers,
            },
        });
    } catch {
        return errors.internal();
    }
}
