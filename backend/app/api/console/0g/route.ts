import { getAuthUser } from '@/lib/privy';
import { prisma } from '@/lib/prisma';
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

        const storageScanBase = (zeroGEnv.storageScanBaseUrl || 'https://storagescan.0g.ai').replace(/\/$/, '');
        const chainScanBase = (zeroGEnv.chainScanBaseUrl || 'https://chainscan.0g.ai').replace(/\/$/, '');

        const [
            merchantState,
            storageResult,
            chainResult,
            computeResult,
            artifacts,
            anchors,
            computeJobs,
            confirmedPaymentCount,
        ] = await Promise.all([
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

            // Recent artifacts for this merchant
            prisma.storedArtifact.findMany({
                where: { merchantId: user.id },
                orderBy: { createdAt: 'desc' },
                take: 50,
            }),

            // Chain anchors for this merchant
            prisma.chainAnchor.findMany({
                where: { merchantId: user.id },
                orderBy: { createdAt: 'desc' },
                take: 50,
            }),

            // Compute jobs for this merchant
            prisma.computeJob.findMany({
                where: { merchantId: user.id },
                orderBy: { createdAt: 'desc' },
                take: 20,
            }),

            // Count of confirmed payments (potential receipts)
            prisma.checkoutSession.count({
                where: {
                    merchantId: user.id,
                    status: 'confirmed',
                },
            }),
        ]);

        const checks = {
            storage: storageResult,
            chain: chainResult,
            compute: computeResult,
        };

        const status = Object.values(checks).every((check) => check.ok) ? 'ok' : 'degraded';

        // Build unified activity feed from artifacts + anchors + compute jobs
        const activity = [
            ...artifacts.map((a) => ({
                id: a.id,
                type: 'artifact' as const,
                kind: a.kind,
                status: a.status,
                storageUri: a.storageUri,
                storageRoot: a.storageRoot,
                storageTxHash: a.storageTxHash,
                payloadHash: a.payloadHash,
                createdAt: a.createdAt.toISOString(),
                explorerUrl: a.storageRoot ? `${storageScanBase}/tx/${a.storageTxHash}` : null,
            })),
            ...anchors.map((a) => ({
                id: a.id,
                type: 'anchor' as const,
                kind: a.kind,
                status: a.status,
                anchorTxHash: a.anchorTxHash,
                anchorChainId: a.anchorChainId,
                payloadHash: a.payloadHash,
                createdAt: a.createdAt.toISOString(),
                explorerUrl: a.anchorTxHash ? `${chainScanBase}/tx/${a.anchorTxHash}` : null,
            })),
            ...computeJobs.map((j) => ({
                id: j.id,
                type: 'compute' as const,
                kind: j.kind,
                status: j.status,
                model: j.model,
                provider: j.provider,
                startedAt: j.startedAt?.toISOString() ?? null,
                completedAt: j.completedAt?.toISOString() ?? null,
                createdAt: j.createdAt.toISOString(),
                errorMessage: j.errorMessage,
            })),
        ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        // Stats
        const receiptArtifacts = artifacts.filter((a) => a.kind === 'receipt_payload');
        const profileArtifacts = artifacts.filter((a) => a.kind === 'merchant_profile');
        const paywallArtifacts = artifacts.filter((a) => a.kind === 'paywall_manifest');
        const memoryArtifacts = artifacts.filter((a) => a.kind === 'merchant_memory_snapshot');

        return apiSuccess({
            status,
            timestamp: new Date().toISOString(),
            explorers: {
                storageScan: storageScanBase,
                chainScan: chainScanBase,
            },
            stats: {
                receiptsStored: receiptArtifacts.length,
                receiptsAnchored: anchors.filter((a) => a.kind === 'receipt_payload').length,
                profilePublished: profileArtifacts.length > 0,
                memoryPublished: memoryArtifacts.length > 0,
                paywallManifests: paywallArtifacts.length,
                aiQueries: computeJobs.length,
                confirmedPayments: confirmedPaymentCount,
            },
            merchant: {
                id: user.id,
                profile: merchantState.profile
                    ? {
                        name: merchantState.profile.name,
                        updatedAt: merchantState.profile.updatedAt,
                        productCount: merchantState.profile.productCount,
                        paywallCount: merchantState.profile.paywallCount,
                        storageUri: merchantState.published.profile?.storageUri ?? null,
                        storageRoot: merchantState.published.profile?.storageRoot ?? null,
                        storageTxHash: merchantState.published.profile?.storageTxHash ?? null,
                        publishedAt: merchantState.published.profile?.createdAt ?? null,
                        published: Boolean(merchantState.published.profile),
                        explorerUrl: merchantState.published.profile?.storageTxHash
                            ? `${storageScanBase}/tx/${merchantState.published.profile.storageTxHash}`
                            : null,
                    }
                    : null,
                memory: merchantState.memory
                    ? {
                        capturedAt: merchantState.memory.capturedAt,
                        productCount: merchantState.memory.products.length,
                        paywallCount: merchantState.memory.paywalls.length,
                        storageUri: merchantState.published.memory?.storageUri ?? null,
                        storageTxHash: merchantState.published.memory?.storageTxHash ?? null,
                        publishedAt: merchantState.published.memory?.createdAt ?? null,
                        published: Boolean(merchantState.published.memory),
                        explorerUrl: merchantState.published.memory?.storageTxHash
                            ? `${storageScanBase}/tx/${merchantState.published.memory.storageTxHash}`
                            : null,
                    }
                    : null,
            },
            activity,
            checks,
        });
    } catch {
        return errors.internal('0G console status failed');
    }
}
