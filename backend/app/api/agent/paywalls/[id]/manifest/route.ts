import { errors, apiSuccess } from '@/lib/errors';
import { getIP, checkRateLimit, rateLimiters } from '@/lib/rate-limit';
import { getPaywallZeroGState } from '@/lib/0g/paywalls';

const VALID_ID_PATTERN = /^[a-z0-9]{20,36}$/;

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const ip = getIP(request);
        const { limited } = await checkRateLimit(rateLimiters.public, ip);
        if (limited) return errors.rateLimited();

        const { id } = await params;
        if (!VALID_ID_PATTERN.test(id)) return errors.notFound('Paywall manifest');
        const state = await getPaywallZeroGState(id).catch(() => null);
        if (!state?.manifest) return errors.notFound('Paywall manifest');

        return apiSuccess({
            paywallId: id,
            manifest: state.manifest,
            zeroG: {
                published: Boolean(state.published),
                created: false,
                storageUri: state.published?.storageUri ?? null,
                storageRoot: state.published?.storageRoot ?? null,
                payloadHash: state.published?.payloadHash ?? null,
            },
        });
    } catch {
        return errors.internal();
    }
}
