import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { zeroGLogger } from '@/lib/logger';
import { anchorReceipt } from '@/lib/0g/chain';
import { isZeroGChainWriteConfigured } from '@/lib/0g/env';
import { buildReceiptSubjectHash, normalizeArtifactRoot } from '@/lib/receipts/payload';

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

    if (!isZeroGChainWriteConfigured()) {
        return NextResponse.json({ message: '0G chain writes not configured', anchored: 0 });
    }

    // Find receipt artifacts that have storage proof but no chain anchor
    const unanchored = await prisma.storedArtifact.findMany({
        where: {
            kind: 'receipt_payload',
            layer: 'log',
            storageRoot: { not: null },
            status: 'published',
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
    });

    let anchored = 0;

    for (const artifact of unanchored) {
        // Check if anchor already exists
        const existing = await prisma.chainAnchor.findFirst({
            where: {
                kind: 'receipt',
                localEntityType: artifact.localEntityType,
                localEntityId: artifact.localEntityId,
            },
        });
        if (existing) continue;

        if (!artifact.storageRoot || !artifact.localEntityId || !artifact.localEntityType || !artifact.merchantId) continue;

        const artifactRoot = normalizeArtifactRoot(artifact.storageRoot);
        const meta = artifact.metadata as Record<string, unknown> | null;
        const txHash = typeof meta?.txHash === 'string' ? meta.txHash : '';

        const subjectHash = buildReceiptSubjectHash({
            merchantId: artifact.merchantId,
            sessionId: artifact.localEntityId,
            txHash,
        });

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
                    },
                },
            });

            anchored++;
            zeroGLogger.info({ artifactId: artifact.id, anchorTxHash: result.anchorTxHash }, 'Chain anchor retry succeeded');
        } catch (err) {
            zeroGLogger.warn({ err, artifactId: artifact.id }, 'Chain anchor retry failed');
        }
    }

    return NextResponse.json({ processed: unanchored.length, anchored });
}
