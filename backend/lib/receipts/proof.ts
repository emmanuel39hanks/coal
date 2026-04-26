import { prisma } from '@/lib/prisma';
import { zeroGLogger } from '@/lib/logger';
import { getLatestAnchor, getLatestArtifact } from '@/lib/0g/catalog';
import { anchorReceipt } from '@/lib/0g/chain';
import {
    isZeroGChainWriteConfigured,
    isZeroGEnabled,
    isZeroGStorageWriteConfigured,
} from '@/lib/0g/env';
import { publishJson } from '@/lib/0g/storage';
import { buildReceiptPayload, buildReceiptSubjectHash, hashReceiptPayload, normalizeArtifactRoot } from '@/lib/receipts/payload';
import type { ZeroGChainAnchorResult, ZeroGPublishedArtifact } from '@/lib/0g/types';
import { anchorReceiptOnWorldChain, isWorldChainAnchorConfigured } from '@/lib/world/chain';
import { resolveChainKey } from '@/lib/chains';

function toPublishedArtifact(record: {
    kind: string;
    layer: string;
    payloadHash: string;
    storageRoot: string | null;
    storageTxHash: string | null;
    storageUri: string | null;
    streamId: string | null;
    kvKey: string | null;
    createdAt: Date;
}) {
    if (!record.storageUri) {
        return null;
    }

    return {
        kind: record.kind as ZeroGPublishedArtifact['kind'],
        layer: record.layer as ZeroGPublishedArtifact['layer'],
        payloadHash: record.payloadHash as `0x${string}`,
        storageRoot: record.storageRoot ?? undefined,
        storageTxHash: record.storageTxHash ?? undefined,
        storageUri: record.storageUri,
        byteSize: 0,
        publishedAt: record.createdAt.toISOString(),
        streamId: record.streamId ?? undefined,
        kvKey: record.kvKey ?? undefined,
    } satisfies ZeroGPublishedArtifact;
}

function toAnchorResult(input: {
    record: {
        payloadHash: string;
        anchorTxHash: string;
        anchorContract: string;
        anchorChainId: number;
        createdAt: Date;
    };
    artifactRoot: `0x${string}`;
    subjectHash: `0x${string}`;
}) {
    return {
        kind: 'receipt',
        payloadHash: input.record.payloadHash as `0x${string}`,
        artifactRoot: input.artifactRoot,
        subjectHash: input.subjectHash,
        anchorTxHash: input.record.anchorTxHash as `0x${string}`,
        anchorContract: input.record.anchorContract as `0x${string}`,
        anchorChainId: input.record.anchorChainId,
        anchoredAt: input.record.createdAt.toISOString(),
    } satisfies ZeroGChainAnchorResult;
}

export async function publishVerifiedReceiptProof(input: {
    session: {
        id: string;
        merchantId: string;
        amount: { toString(): string };
        currency: string;
        description?: string | null;
        metadata?: unknown;
        createdAt: Date;
        /** World-3: which chain the payment settled on. */
        settlementChain?: string | null;
    };
    merchant: {
        id: string;
        name?: string | null;
        email?: string | null;
        payoutAddress?: string | null;
    };
    transaction: {
        txHash: string;
        from: string;
        to: string;
        amount: string;
        status: string;
        blockNumber?: number | null;
        confirmedAt?: Date | string | null;
    };
}) {
    if (!isZeroGEnabled()) {
        return { skipped: true as const, reason: 'disabled' as const };
    }

    if (!isZeroGStorageWriteConfigured()) {
        return { skipped: true as const, reason: 'storage_not_configured' as const };
    }

    const payload = buildReceiptPayload(input);
    const payloadHash = hashReceiptPayload(payload);
    const existingArtifact = await getLatestArtifact({
        kind: 'receipt_payload',
        localEntityType: 'checkout_session',
        localEntityId: input.session.id,
    });
    const existingArtifactTxHash =
        existingArtifact?.metadata &&
        typeof existingArtifact.metadata === 'object' &&
        existingArtifact.metadata !== null &&
        'txHash' in existingArtifact.metadata &&
        typeof (existingArtifact.metadata as Record<string, unknown>).txHash === 'string'
            ? ((existingArtifact.metadata as Record<string, unknown>).txHash as string)
            : null;

    const artifact =
        existingArtifact?.storageUri && (
            existingArtifact.payloadHash === payloadHash ||
            existingArtifactTxHash === input.transaction.txHash
        )
            ? toPublishedArtifact(existingArtifact)
            : null;
    const effectivePayloadHash = (artifact?.payloadHash ?? payloadHash) as `0x${string}`;

    const publishedArtifact = artifact ?? await publishJson({
        kind: 'receipt_payload',
        payload,
    });

    if (!artifact) {
        await prisma.storedArtifact.create({
            data: {
                merchantId: input.session.merchantId,
                kind: 'receipt_payload',
                layer: 'log',
                localEntityType: 'checkout_session',
                localEntityId: input.session.id,
                payloadHash: effectivePayloadHash,
                storageRoot: publishedArtifact.storageRoot,
                storageTxHash: publishedArtifact.storageTxHash,
                storageUri: publishedArtifact.storageUri,
                status: 'published',
                metadata: {
                    version: payload.version,
                    txHash: input.transaction.txHash,
                },
            },
        });
    }

    let anchor = null;
    const subjectHash = buildReceiptSubjectHash({
        merchantId: input.session.merchantId,
        sessionId: input.session.id,
        txHash: input.transaction.txHash,
    });
    const artifactRoot = publishedArtifact.storageRoot
        ? normalizeArtifactRoot(publishedArtifact.storageRoot)
        : null;

    if (isZeroGChainWriteConfigured() && artifactRoot) {
        const existingAnchor = await getLatestAnchor({
            kind: 'receipt',
            localEntityType: 'checkout_session',
            localEntityId: input.session.id,
        });

        if (existingAnchor && (artifact || existingAnchor.payloadHash === effectivePayloadHash)) {
            anchor = toAnchorResult({
                record: existingAnchor,
                artifactRoot,
                subjectHash,
            });
        }
    }

    // Chain anchor runs async (fire-and-forget) to avoid blocking payment confirmation.
    // 0G Chain tx + waitForReceipt can take 10-45s which exceeds serverless timeouts.
    if (!anchor && isZeroGChainWriteConfigured() && artifactRoot) {
        const anchorAsync = async () => {
            try {
                const result = await anchorReceipt(
                    effectivePayloadHash,
                    artifactRoot,
                    subjectHash,
                );

                await prisma.chainAnchor.create({
                    data: {
                        merchantId: input.session.merchantId,
                        kind: 'receipt',
                        localEntityType: 'checkout_session',
                        localEntityId: input.session.id,
                        payloadHash: effectivePayloadHash,
                        anchorContract: result.anchorContract,
                        anchorTxHash: result.anchorTxHash,
                        anchorChainId: result.anchorChainId,
                        status: 'confirmed',
                        metadata: {
                            storageRoot: publishedArtifact.storageRoot,
                            artifactRoot,
                            subjectHash,
                            txHash: input.transaction.txHash,
                            anchorSource: '0g',
                        },
                    },
                });

                zeroGLogger.info(
                    { checkoutSessionId: input.session.id, anchorTxHash: result.anchorTxHash },
                    '0G chain anchor completed (async)',
                );
            } catch (error) {
                zeroGLogger.warn(
                    { err: error, checkoutSessionId: input.session.id, txHash: input.transaction.txHash },
                    '0G receipt anchor write failed (async) — will retry on next cron run',
                );
            }
        };
        // Fire and forget — don't await
        anchorAsync().catch(() => null);
    }

    // World-3: additional settlement-chain anchor.
    // Only fires when the session settled on World Chain, and only as a
    // supplementary anchor — the 0G anchor above remains canonical.
    // The cron retry path (cron/anchor-receipts) will catch failures.
    const settlementChainKey = resolveChainKey(input.session.settlementChain);
    if (settlementChainKey === 'worldchain' && artifactRoot && isWorldChainAnchorConfigured()) {
        const anchorWorldAsync = async () => {
            try {
                // Skip if a World Chain anchor already exists for this session (idempotent retry).
                const existing = await prisma.chainAnchor.findFirst({
                    where: {
                        kind: 'receipt',
                        localEntityType: 'checkout_session',
                        localEntityId: input.session.id,
                        anchorChainId: { in: [480, 4801] },
                    },
                    select: { id: true },
                });
                if (existing) return;

                const result = await anchorReceiptOnWorldChain(
                    effectivePayloadHash,
                    artifactRoot,
                    subjectHash,
                );

                await prisma.chainAnchor.create({
                    data: {
                        merchantId: input.session.merchantId,
                        kind: 'receipt',
                        localEntityType: 'checkout_session',
                        localEntityId: input.session.id,
                        payloadHash: effectivePayloadHash,
                        anchorContract: result.anchorContract,
                        anchorTxHash: result.anchorTxHash,
                        anchorChainId: result.anchorChainId,
                        status: 'confirmed',
                        metadata: {
                            storageRoot: publishedArtifact.storageRoot,
                            artifactRoot,
                            subjectHash,
                            txHash: input.transaction.txHash,
                            anchorSource: 'worldchain',
                        },
                    },
                });

                zeroGLogger.info(
                    {
                        checkoutSessionId: input.session.id,
                        anchorTxHash: result.anchorTxHash,
                        anchorChainId: result.anchorChainId,
                    },
                    'World Chain anchor completed (async)',
                );
            } catch (error) {
                zeroGLogger.warn(
                    { err: error, checkoutSessionId: input.session.id, txHash: input.transaction.txHash },
                    'World Chain receipt anchor write failed (async) — will retry on next cron run',
                );
            }
        };
        anchorWorldAsync().catch(() => null);
    }

    return { skipped: false as const, payloadHash: effectivePayloadHash, artifact: publishedArtifact, anchor };
}
