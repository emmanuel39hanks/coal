import { prisma } from '@/lib/prisma';
import { errors, apiSuccess } from '@/lib/errors';
import { getIP, checkRateLimit, rateLimiters } from '@/lib/rate-limit';
import { zeroGEnv } from '@/lib/0g/env';
import { EXPLORER_URL } from '@/lib/chain';

// H1: Validate checkout ID format before DB query
const VALID_ID_PATTERN = /^[a-z0-9]{20,36}$/;

/**
 * Public receipt verification endpoint.
 * Returns the full proof trail for a checkout session:
 * - Payment transaction on Base
 * - Receipt artifact on 0G Storage
 * - Anchor transaction on 0G Chain
 *
 * No auth required — anyone with a checkout ID can verify.
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const ip = getIP(request);
        const { limited } = await checkRateLimit(rateLimiters.public, ip);
        if (limited) return errors.rateLimited();

        const { id } = await params;

        if (!VALID_ID_PATTERN.test(id)) {
            return errors.notFound('Receipt');
        }

        const session = await prisma.checkoutSession.findUnique({
            where: { id },
            select: {
                id: true,
                status: true,
                amount: true,
                currency: true,
                description: true,
                txHash: true,
                createdAt: true,
                merchant: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        });

        if (!session) return errors.notFound('Receipt');

        if (session.status !== 'confirmed' || !session.txHash) {
            return apiSuccess({
                checkoutId: id,
                status: session.status,
                verified: false,
                proofTrail: null,
            });
        }

        // Fetch 0G Storage artifact
        const artifact = await prisma.storedArtifact.findFirst({
            where: {
                kind: 'receipt_payload',
                localEntityType: 'checkout_session',
                localEntityId: id,
                layer: 'log',
                status: 'published',
            },
            orderBy: { createdAt: 'desc' },
            select: {
                storageUri: true,
                storageRoot: true,
                storageTxHash: true,
                payloadHash: true,
                createdAt: true,
            },
        });

        // Fetch 0G Chain anchor
        const anchor = await prisma.chainAnchor.findFirst({
            where: {
                kind: 'receipt',
                localEntityType: 'checkout_session',
                localEntityId: id,
            },
            orderBy: { createdAt: 'desc' },
            select: {
                anchorTxHash: true,
                anchorContract: true,
                anchorChainId: true,
                payloadHash: true,
                createdAt: true,
            },
        });

        return apiSuccess({
            checkoutId: id,
            status: 'confirmed',
            verified: true,
            merchant: {
                name: session.merchant.name,
            },
            payment: {
                amount: session.amount.toString(),
                currency: session.currency,
                description: session.description,
                txHash: session.txHash,
                explorerUrl: `${EXPLORER_URL}/tx/${session.txHash}`,
                paidAt: session.createdAt.toISOString(),
            },
            proofTrail: {
                storage: artifact
                    ? {
                        storageUri: artifact.storageUri,
                        storageRoot: artifact.storageRoot,
                        storageTxHash: artifact.storageTxHash,
                        payloadHash: artifact.payloadHash,
                        explorerUrl: artifact.storageRoot
                            ? `${zeroGEnv.storageScanBaseUrl}/tx/${artifact.storageTxHash}`
                            : null,
                        publishedAt: artifact.createdAt.toISOString(),
                    }
                    : null,
                chain: anchor
                    ? {
                        anchorTxHash: anchor.anchorTxHash,
                        anchorContract: anchor.anchorContract,
                        anchorChainId: anchor.anchorChainId,
                        payloadHash: anchor.payloadHash,
                        explorerUrl: `${zeroGEnv.chainScanBaseUrl}/tx/${anchor.anchorTxHash}`,
                        anchoredAt: anchor.createdAt.toISOString(),
                    }
                    : null,
            },
        });
    } catch {
        return errors.internal();
    }
}
