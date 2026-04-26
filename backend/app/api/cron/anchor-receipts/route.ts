import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { zeroGLogger } from '@/lib/logger';
import { anchorReceipt } from '@/lib/0g/chain';
import { isZeroGChainWriteConfigured } from '@/lib/0g/env';
import { buildReceiptSubjectHash, normalizeArtifactRoot } from '@/lib/receipts/payload';
import { anchorReceiptOnWorldChain, isWorldChainAnchorConfigured } from '@/lib/world/chain';

export async function POST(request: Request) {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || !authHeader) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const expected = Buffer.from(`Bearer ${cronSecret}`);
    const actual = Buffer.from(authHeader);
    if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const zeroGConfigured = isZeroGChainWriteConfigured();
    const worldConfigured = isWorldChainAnchorConfigured();
    if (!zeroGConfigured && !worldConfigured) {
        return NextResponse.json({ message: 'No chain anchor backends configured', anchored: 0 });
    }

    // Find receipt artifacts that have storage proof but may be missing anchors.
    // We fetch more than we'll process and filter per-backend below.
    const candidates = await prisma.storedArtifact.findMany({
        where: {
            kind: 'receipt_payload',
            layer: 'log',
            storageRoot: { not: null },
            status: 'published',
        },
        orderBy: { createdAt: 'desc' },
        take: 40,
    });

    let anchored0G = 0;
    let anchoredWorld = 0;
    const ZERO_G_CHAIN_IDS = [16661, 16600];   // mainnet + historical testnet
    const WORLD_CHAIN_IDS = [480, 4801];

    for (const artifact of candidates) {
        if (!artifact.storageRoot || !artifact.localEntityId || !artifact.localEntityType || !artifact.merchantId) continue;

        const artifactRoot = normalizeArtifactRoot(artifact.storageRoot);
        const meta = artifact.metadata as Record<string, unknown> | null;
        const txHash = typeof meta?.txHash === 'string' ? meta.txHash : '';

        const subjectHash = buildReceiptSubjectHash({
            merchantId: artifact.merchantId,
            sessionId: artifact.localEntityId,
            txHash,
        });

        // Load the session once to learn its settlement chain (for the World Chain branch).
        const session = artifact.localEntityType === 'checkout_session'
            ? await prisma.checkoutSession.findUnique({
                where: { id: artifact.localEntityId },
                select: { settlementChain: true },
            }).catch(() => null)
            : null;

        // ─── 0G anchor retry ──────────────────────────────────────────
        if (zeroGConfigured) {
            const existing0G = await prisma.chainAnchor.findFirst({
                where: {
                    kind: 'receipt',
                    localEntityType: artifact.localEntityType,
                    localEntityId: artifact.localEntityId,
                    anchorChainId: { in: ZERO_G_CHAIN_IDS },
                },
                select: { id: true },
            });
            if (!existing0G) {
                try {
                    const result = await anchorReceipt(
                        artifact.payloadHash as `0x${string}`,
                        artifactRoot,
                        subjectHash,
                    );

                    await prisma.chainAnchor.create({
                        data: {
                            merchantId: artifact.merchantId,
                            kind: 'receipt',
                            localEntityType: artifact.localEntityType!,
                            localEntityId: artifact.localEntityId,
                            payloadHash: artifact.payloadHash,
                            anchorContract: result.anchorContract,
                            anchorTxHash: result.anchorTxHash,
                            anchorChainId: result.anchorChainId,
                            status: 'confirmed',
                            metadata: {
                                storageRoot: artifact.storageRoot,
                                artifactRoot,
                                subjectHash,
                                txHash,
                                anchorSource: '0g',
                            },
                        },
                    });

                    anchored0G++;
                    zeroGLogger.info({ artifactId: artifact.id, anchorTxHash: result.anchorTxHash }, '0G anchor retry succeeded');
                } catch (err) {
                    zeroGLogger.warn({ err, artifactId: artifact.id }, '0G anchor retry failed');
                }
            }
        }

        // ─── World Chain anchor retry ─────────────────────────────────
        // Only retry if the session settled on World Chain. Do NOT anchor
        // Base-settled receipts on World Chain — that would muddy the proof trail.
        if (
            worldConfigured &&
            session?.settlementChain === 'worldchain'
        ) {
            const existingWorld = await prisma.chainAnchor.findFirst({
                where: {
                    kind: 'receipt',
                    localEntityType: artifact.localEntityType,
                    localEntityId: artifact.localEntityId,
                    anchorChainId: { in: WORLD_CHAIN_IDS },
                },
                select: { id: true },
            });
            if (!existingWorld) {
                try {
                    const result = await anchorReceiptOnWorldChain(
                        artifact.payloadHash as `0x${string}`,
                        artifactRoot,
                        subjectHash,
                    );

                    await prisma.chainAnchor.create({
                        data: {
                            merchantId: artifact.merchantId,
                            kind: 'receipt',
                            localEntityType: artifact.localEntityType!,
                            localEntityId: artifact.localEntityId,
                            payloadHash: artifact.payloadHash,
                            anchorContract: result.anchorContract,
                            anchorTxHash: result.anchorTxHash,
                            anchorChainId: result.anchorChainId,
                            status: 'confirmed',
                            metadata: {
                                storageRoot: artifact.storageRoot,
                                artifactRoot,
                                subjectHash,
                                txHash,
                                anchorSource: 'worldchain',
                            },
                        },
                    });

                    anchoredWorld++;
                    zeroGLogger.info(
                        { artifactId: artifact.id, anchorTxHash: result.anchorTxHash, anchorChainId: result.anchorChainId },
                        'World Chain anchor retry succeeded',
                    );
                } catch (err) {
                    zeroGLogger.warn({ err, artifactId: artifact.id }, 'World Chain anchor retry failed');
                }
            }
        }
    }

    return NextResponse.json({
        processed: candidates.length,
        anchored: anchored0G + anchoredWorld,
        details: { anchored0G, anchoredWorld },
    });
}
