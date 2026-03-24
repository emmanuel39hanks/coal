import { errors, apiSuccess } from '@/lib/errors';
import { getIP, checkRateLimit, rateLimiters } from '@/lib/rate-limit';
import { getMerchantZeroGState } from '@/lib/0g/merchant';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ merchantId: string }> },
) {
    try {
        const ip = getIP(request);
        const { limited } = await checkRateLimit(rateLimiters.public, ip);
        if (limited) return errors.rateLimited();

        const { merchantId } = await params;
        const state = await getMerchantZeroGState(merchantId).catch(() => null);
        if (!state?.profile) return errors.notFound('Merchant profile');

        return apiSuccess({
            merchantId,
            profile: state.profile,
            zeroG: {
                published: Boolean(state.published.profile),
                created: false,
                storageUri: state.published.profile?.storageUri ?? null,
                storageRoot: state.published.profile?.storageRoot ?? null,
                payloadHash: state.published.profile?.payloadHash ?? null,
            },
        });
    } catch {
        return errors.internal();
    }
}
