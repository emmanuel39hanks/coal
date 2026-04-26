import { prisma } from '@/lib/prisma';
import { errors, apiSuccess } from '@/lib/errors';
import { getIP, checkRateLimit, rateLimiters } from '@/lib/rate-limit';
import { zeroGEnv } from '@/lib/0g/env';
import { EXPLORER_URL } from '@/lib/chain';
import { getChainByChainId, getChainByKey, resolveChainKey } from '@/lib/chains';

/**
 * Return the correct tx explorer URL for the given chain ID.
 * Falls back to a "#" placeholder on unknown chains so the UI doesn't crash.
 */
function explorerTxUrl(chainId: number | null | undefined, txHash: string): string {
    if (!chainId) return '#';
    // 0G mainnet / historical testnet
    if (chainId === 16661 || chainId === 16600) {
        return `${zeroGEnv.chainScanBaseUrl}/tx/${txHash}`;
    }
    const cfg = getChainByChainId(chainId);
    if (cfg) return `${cfg.explorerUrl}/tx/${txHash}`;
    return '#';
}

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
                settlementChain: true,
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

        // Fetch ALL chain anchors for this session (may include 0G and World Chain).
        // World-3: a single session can have multiple anchors — one on 0G (canonical)
        // and optionally one on the settlement chain (World Chain). The frontend
        // renders them as separate rows in the proof trail.
        const anchorRows = await prisma.chainAnchor.findMany({
            where: {
                kind: 'receipt',
                localEntityType: 'checkout_session',
                localEntityId: id,
            },
            orderBy: { createdAt: 'asc' },
            select: {
                anchorTxHash: true,
                anchorContract: true,
                anchorChainId: true,
                payloadHash: true,
                createdAt: true,
                metadata: true,
            },
        });

        // Chain-aware explorer URL for the settlement transaction.
        const chainKey = resolveChainKey(session.settlementChain);
        const settlementCfg = getChainByKey(chainKey);
        const paymentExplorerUrl = chainKey === 'base'
            ? `${EXPLORER_URL}/tx/${session.txHash}`
            : `${settlementCfg.explorerUrl}/tx/${session.txHash}`;

        // Preserve the legacy `chain` shape (first 0G anchor if present, else first row)
        // so any existing client keeps working. The new `chainAnchors` array carries
        // the full multi-chain list for UIs that want to render both.
        const zeroGAnchor = anchorRows.find(a => a.anchorChainId === 16661 || a.anchorChainId === 16600) || null;
        const legacyAnchor = zeroGAnchor || anchorRows[0] || null;

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
                chain: chainKey,
                chainId: settlementCfg.chainId,
                chainName: settlementCfg.displayName,
                explorerUrl: paymentExplorerUrl,
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
                // Legacy single-anchor field (0G-preferred) for backwards compatibility.
                chain: legacyAnchor
                    ? {
                        anchorTxHash: legacyAnchor.anchorTxHash,
                        anchorContract: legacyAnchor.anchorContract,
                        anchorChainId: legacyAnchor.anchorChainId,
                        payloadHash: legacyAnchor.payloadHash,
                        explorerUrl: explorerTxUrl(legacyAnchor.anchorChainId, legacyAnchor.anchorTxHash),
                        anchoredAt: legacyAnchor.createdAt.toISOString(),
                    }
                    : null,
                // New: full array of anchors, in chronological order.
                chainAnchors: anchorRows.map((a) => {
                    const meta = a.metadata as Record<string, unknown> | null;
                    const anchorSource = typeof meta?.anchorSource === 'string'
                        ? meta.anchorSource
                        : (a.anchorChainId === 16661 || a.anchorChainId === 16600 ? '0g' : 'worldchain');
                    return {
                        anchorTxHash: a.anchorTxHash,
                        anchorContract: a.anchorContract,
                        anchorChainId: a.anchorChainId,
                        anchorSource,
                        payloadHash: a.payloadHash,
                        explorerUrl: explorerTxUrl(a.anchorChainId, a.anchorTxHash),
                        anchoredAt: a.createdAt.toISOString(),
                    };
                }),
            },
        });
    } catch {
        return errors.internal();
    }
}
