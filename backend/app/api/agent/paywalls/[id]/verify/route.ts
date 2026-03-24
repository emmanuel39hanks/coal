import { errors, apiSuccess } from '@/lib/errors';
import { getIP, checkRateLimit, rateLimiters } from '@/lib/rate-limit';
import { getPaywallVerificationState } from '@/lib/paywall-verification';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const ip = getIP(request);
        const { limited } = await checkRateLimit(rateLimiters.public, ip);
        if (limited) return errors.rateLimited();

        const { id } = await params;
        const url = new URL(request.url);
        const verification = await getPaywallVerificationState({
            paywallId: id,
            address: url.searchParams.get('address'),
            did: url.searchParams.get('did'),
            agentId: url.searchParams.get('agentId'),
        });

        if (!verification) {
            return errors.notFound('Paywall');
        }

        return apiSuccess({
            paymentRequired: !verification.paid,
            ...verification.body,
        });
    } catch {
        return errors.internal();
    }
}
