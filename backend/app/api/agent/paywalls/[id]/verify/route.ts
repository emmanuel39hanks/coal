import { errors, apiSuccess } from '@/lib/errors';
import { getIP, checkRateLimit, rateLimiters } from '@/lib/rate-limit';
import { getPaywallVerificationState } from '@/lib/paywall-verification';

const VALID_ID_PATTERN = /^[a-z0-9]{20,36}$/;
const VALID_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;
const MAX_SUBJECT_LEN = 255;

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const ip = getIP(request);
        const { limited } = await checkRateLimit(rateLimiters.public, ip);
        if (limited) return errors.rateLimited();

        const { id } = await params;

        if (!VALID_ID_PATTERN.test(id)) {
            return errors.notFound('Paywall');
        }

        const url = new URL(request.url);
        const rawAddress = url.searchParams.get('address');
        const rawDid = url.searchParams.get('did');
        const rawAgentId = url.searchParams.get('agentId');

        const verification = await getPaywallVerificationState({
            paywallId: id,
            address: rawAddress && VALID_ADDRESS_PATTERN.test(rawAddress) ? rawAddress : null,
            did: rawDid && rawDid.length <= MAX_SUBJECT_LEN ? rawDid : null,
            agentId: rawAgentId && rawAgentId.length <= MAX_SUBJECT_LEN ? rawAgentId : null,
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
