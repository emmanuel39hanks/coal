import { getAuthUser } from '@/lib/privy';
import { apiSuccess, errors } from '@/lib/errors';
import { getMerchantZeroGState } from '@/lib/0g/merchant';
import { checkZeroGChainHealth } from '@/lib/0g/chain';
import { checkStorageHealth } from '@/lib/0g/storage';
import { listComputeServices } from '@/lib/0g/compute';
import { zeroGEnv } from '@/lib/0g/env';

export async function GET(request: Request) {
    try {
        const user = await getAuthUser(request);
        if (!user) return errors.unauthorized();

        const [merchantState, storageResult, chainResult, computeResult] = await Promise.all([
            getMerchantZeroGState(user.id),
            checkStorageHealth()
                .then((details) => ({ ok: true as const, details }))
                .catch((error) => ({
                    ok: false as const,
                    error: error instanceof Error ? error.message : '0G storage health failed',
                })),
            checkZeroGChainHealth()
                .then((details) => ({ ok: true as const, details }))
                .catch((error) => ({
                    ok: false as const,
                    error: error instanceof Error ? error.message : '0G chain health failed',
                })),
            listComputeServices(3)
                .then((services) => ({
                    ok: true as const,
                    details: {
                        enabled: zeroGEnv.computeEnabled,
                        configured: Boolean(zeroGEnv.computeBaseUrl && zeroGEnv.computeApiKey),
                        provider: zeroGEnv.computeProvider || null,
                        model: zeroGEnv.computeModel || null,
                        services: services.map((service) => ({
                            providerAddress: service.providerAddress,
                            model: service.model,
                            endpoint: service.endpoint ?? null,
                            serviceName: service.serviceName ?? null,
                            uptimePct: service.uptimePct,
                            avgLatencyMs: service.avgLatencyMs,
                        })),
                    },
                }))
                .catch((error) => ({
                    ok: false as const,
                    error: error instanceof Error ? error.message : '0G compute health failed',
                })),
        ]);

        const checks = {
            storage: storageResult,
            chain: chainResult,
            compute: computeResult,
        };

        const status = Object.values(checks).every((check) => check.ok) ? 'ok' : 'degraded';

        return apiSuccess({
            status,
            timestamp: new Date().toISOString(),
            targetStorageMbps: zeroGEnv.storageTargetMbps,
            merchant: {
                id: user.id,
                profile: merchantState.profile
                    ? {
                        name: merchantState.profile.name,
                        updatedAt: merchantState.profile.updatedAt,
                        productCount: merchantState.profile.productCount,
                        paywallCount: merchantState.profile.paywallCount,
                        teamSize: merchantState.profile.teamSize,
                        onboardingComplete: merchantState.profile.onboardingComplete,
                        capabilities: merchantState.profile.capabilities,
                        endpoints: merchantState.profile.endpoints,
                        urls: merchantState.profile.urls,
                        storageUri: merchantState.published.profile?.storageUri ?? null,
                        storageRoot: merchantState.published.profile?.storageRoot ?? null,
                        payloadHash: merchantState.published.profile?.payloadHash ?? null,
                        publishedAt: merchantState.published.profile?.createdAt ?? null,
                        published: Boolean(merchantState.published.profile),
                    }
                    : null,
                memory: merchantState.memory
                    ? {
                        capturedAt: merchantState.memory.capturedAt,
                        productCount: merchantState.memory.products.length,
                        paywallCount: merchantState.memory.paywalls.length,
                        teamSize: merchantState.memory.team.length,
                        storageUri: merchantState.published.memory?.storageUri ?? null,
                        storageRoot: merchantState.published.memory?.storageRoot ?? null,
                        payloadHash: merchantState.published.memory?.payloadHash ?? null,
                        publishedAt: merchantState.published.memory?.createdAt ?? null,
                        published: Boolean(merchantState.published.memory),
                    }
                    : null,
            },
            checks,
        });
    } catch {
        return errors.internal('0G console status failed');
    }
}
