import { validateApiKey } from '@/lib/api-auth';
import { errors, apiSuccess } from '@/lib/errors';
import { checkRateLimit, rateLimiters } from '@/lib/rate-limit';
import { getMerchantZeroGState, syncMerchantArtifacts } from '@/lib/0g/merchant';

export async function POST(request: Request) {
    try {
        const keyRecord = await validateApiKey(request);
        if (!keyRecord) return errors.unauthorized('Invalid or missing API Key');

        const { limited } = await checkRateLimit(rateLimiters.checkout, keyRecord.id);
        if (limited) return errors.rateLimited();

        const syncResult = await syncMerchantArtifacts(keyRecord.merchant.id);
        const currentState =
            syncResult?.profile?.artifact && syncResult?.memory?.artifact
                ? null
                : await getMerchantZeroGState(keyRecord.merchant.id);
        const profileArtifact = syncResult?.profile?.artifact ?? currentState?.published.profile ?? null;
        const memoryArtifact = syncResult?.memory?.artifact ?? currentState?.published.memory ?? null;

        return apiSuccess({
            merchantId: keyRecord.merchant.id,
            ingestedAt: new Date().toISOString(),
            zeroG: {
                sync: syncResult,
                profile: {
                    storageUri: profileArtifact?.storageUri ?? null,
                    storageRoot: profileArtifact?.storageRoot ?? null,
                    payloadHash: profileArtifact?.payloadHash ?? null,
                },
                memory: {
                    storageUri: memoryArtifact?.storageUri ?? null,
                    storageRoot: memoryArtifact?.storageRoot ?? null,
                    payloadHash: memoryArtifact?.payloadHash ?? null,
                },
            },
        });
    } catch {
        return errors.internal();
    }
}
