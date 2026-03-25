import { NextResponse } from 'next/server';
import { errors } from '@/lib/errors';
import { getIP, checkRateLimit, rateLimiters } from '@/lib/rate-limit';
import { checkZeroGChainHealth } from '@/lib/0g/chain';
import { listComputeServices } from '@/lib/0g/compute';
import { zeroGEnv } from '@/lib/0g/env';
import { checkStorageHealth, getStoragePerformancePlaybook } from '@/lib/0g/storage';
import { checkDAHealth } from '@/lib/0g/da';

export async function GET(request: Request) {
    try {
        // C2: Rate limit the public health endpoint
        const ip = getIP(request);
        const { limited } = await checkRateLimit(rateLimiters.public, ip);
        if (limited) return errors.rateLimited();
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

        const [storage, chain, compute, da] = await Promise.all([
            checkStorageHealth()
                .then((details) => ({
                    ok: true as const,
                    details,
                }))
                .catch(() => ({
                    ok: false as const,
                    error: '0G storage unavailable',
                })),
            checkZeroGChainHealth()
                .then((details) => ({
                    ok: true as const,
                    details,
                }))
                .catch(() => ({
                    ok: false as const,
                    error: '0G chain unavailable',
                })),
            listComputeServices(3)
                .then((services) => ({
                    ok: true as const,
                    details: {
                        enabled: zeroGEnv.computeEnabled,
                        configured: Boolean(zeroGEnv.computeBaseUrl && zeroGEnv.computeApiKey),
                        // C2: Don't expose provider addresses, endpoints, or internal URLs
                        serviceCount: services.length,
                    },
                }))
                .catch(() => ({
                    ok: false as const,
                    error: '0G compute unavailable',
                })),
            checkDAHealth()
                .then((details) => ({
                    ok: details.connected || !details.enabled,
                    // C2: Strip gRPC URL and detailed errors from public response
                    details: {
                        enabled: details.enabled,
                        connected: details.connected,
                    },
                }))
                .catch(() => ({
                    ok: false as const,
                    error: '0G DA unavailable',
                })),
        ]);

        const checks: Record<string, { ok: boolean; details?: unknown; error?: string }> = {
            storage,
            chain,
            compute,
            da,
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
