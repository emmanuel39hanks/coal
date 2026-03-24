import { NextResponse } from 'next/server';
import { errors } from '@/lib/errors';
import { checkZeroGChainHealth } from '@/lib/0g/chain';
import { listComputeServices } from '@/lib/0g/compute';
import { zeroGEnv } from '@/lib/0g/env';
import { checkStorageHealth, getStoragePerformancePlaybook } from '@/lib/0g/storage';

export async function GET() {
    try {
        if (!zeroGEnv.enabled && !zeroGEnv.computeEnabled) {
            return NextResponse.json(
                {
                    status: 'disabled',
                    timestamp: new Date().toISOString(),
                    checks: {
                        zeroG: { ok: false, reason: 'ZERO_G_ENABLED=false and ZERO_G_COMPUTE_ENABLED=false' },
                    },
                },
                { status: 200 },
            );
        }

        const [storage, chain, compute] = await Promise.all([
            checkStorageHealth()
                .then((details) => ({
                    ok: true as const,
                    details,
                }))
                .catch((error) => ({
                    ok: false as const,
                    error: error instanceof Error ? error.message : '0G storage health failed',
                })),
            checkZeroGChainHealth()
                .then((details) => ({
                    ok: true as const,
                    details,
                }))
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

        const checks: Record<string, { ok: boolean; details?: unknown; error?: string }> = {
            storage,
            chain,
            compute,
        };

        const allOk = Object.values(checks).every((check) => check.ok);

        return NextResponse.json(
            {
                status: allOk ? 'ok' : 'degraded',
                timestamp: new Date().toISOString(),
                targetStorageMbps: zeroGEnv.storageTargetMbps,
                retrievalPlaybook: getStoragePerformancePlaybook(),
                checks,
            },
            { status: 200 },
        );
    } catch {
        return errors.internal('0G health check failed');
    }
}
