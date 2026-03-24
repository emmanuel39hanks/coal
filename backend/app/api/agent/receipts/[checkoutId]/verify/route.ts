import { prisma } from '@/lib/prisma';
import { validateApiKey } from '@/lib/api-auth';
import { errors, apiSuccess } from '@/lib/errors';
import { publishVerifiedReceiptProof } from '@/lib/receipts/proof';
import { loadJsonArtifact } from '@/lib/0g/storage';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ checkoutId: string }> },
) {
    try {
        const keyRecord = await validateApiKey(request);
        if (!keyRecord) return errors.unauthorized('Invalid or missing API Key');

        const { checkoutId } = await params;
        const session = await prisma.checkoutSession.findFirst({
            where: {
                id: checkoutId,
                merchantId: keyRecord.merchant.id,
            },
            include: {
                merchant: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        payoutAddress: true,
                    },
                },
            },
        });

        if (!session) return errors.notFound('Checkout session');
        if (session.status !== 'confirmed' || !session.txHash) {
            return apiSuccess({
                checkoutId,
                status: session.status,
                verified: false,
            });
        }

        let artifact = await prisma.storedArtifact.findFirst({
            where: {
                merchantId: keyRecord.merchant.id,
                kind: 'receipt_payload',
                localEntityType: 'checkout_session',
                localEntityId: checkoutId,
                layer: 'log',
                status: 'published',
            },
            orderBy: { createdAt: 'desc' },
        });

        if (!artifact) {
            const transaction = await prisma.transaction.findUnique({
                where: { txHash: session.txHash },
            });

            if (!transaction) return errors.notFound('Receipt transaction');

            const published = await publishVerifiedReceiptProof({
                session,
                merchant: session.merchant,
                transaction: {
                    txHash: transaction.txHash,
                    from: transaction.from,
                    to: transaction.to,
                    amount: transaction.amount.toString(),
                    blockNumber: transaction.blockNumber,
                    status: transaction.status,
                },
            });

            if (!published.skipped) {
                artifact = await prisma.storedArtifact.findFirst({
                    where: {
                        merchantId: keyRecord.merchant.id,
                        kind: 'receipt_payload',
                        localEntityType: 'checkout_session',
                        localEntityId: checkoutId,
                        layer: 'log',
                        status: 'published',
                    },
                    orderBy: { createdAt: 'desc' },
                });
            }
        }

        if (!artifact?.storageRoot) {
            return apiSuccess({
                checkoutId,
                status: session.status,
                verified: true,
                zeroG: null,
            });
        }

        const payload = await loadJsonArtifact<Record<string, unknown>>(artifact.storageRoot).catch(() => null);
        const anchor = await prisma.chainAnchor.findFirst({
            where: {
                merchantId: keyRecord.merchant.id,
                kind: 'receipt',
                localEntityType: 'checkout_session',
                localEntityId: checkoutId,
            },
            orderBy: { createdAt: 'desc' },
        });

        return apiSuccess({
            checkoutId,
            status: session.status,
            verified: true,
            receipt: payload?.payload || null,
            zeroG: {
                storageUri: artifact.storageUri,
                storageRoot: artifact.storageRoot,
                payloadHash: artifact.payloadHash,
                anchorTxHash: anchor?.anchorTxHash || null,
                anchorContract: anchor?.anchorContract || null,
            },
        });
    } catch {
        return errors.internal();
    }
}
