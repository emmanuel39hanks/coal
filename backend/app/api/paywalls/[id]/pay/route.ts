import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { errors, apiSuccess } from '@/lib/errors';
import { rateLimiters, checkRateLimit, getIP } from '@/lib/rate-limit';
import { validateBody } from '@/lib/schemas';

const VALID_ID_PATTERN = /^[a-z0-9]{20,36}$/;

const payPaywallSchema = z.object({
    address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid EVM address'),
    txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid transaction hash'),
});

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const ip = getIP(request);
        const { limited } = await checkRateLimit(rateLimiters.public, ip);
        if (limited) return errors.rateLimited();

        const { id } = await params;

        if (!VALID_ID_PATTERN.test(id)) {
            return errors.notFound('Paywall');
        }

        const body = await request.json().catch(() => ({}));
        const validated = validateBody(payPaywallSchema, body);
        if (!validated.success) return validated.error;

        const { address, txHash } = validated.data;
        const normalizedTxHash = txHash.toLowerCase();

        const paywall = await prisma.paywall.findUnique({ where: { id } });
        if (!paywall || !paywall.active) {
            return errors.notFound('Paywall');
        }

        // Atomic txHash dedup check + session creation inside a transaction
        // to prevent race conditions where two concurrent requests both pass
        // the uniqueness check
        const session = await prisma.$transaction(async (tx) => {
            const existingTx = await tx.transaction.findUnique({
                where: { txHash },
                select: { id: true },
            });
            if (existingTx) {
                throw new Error('TXHASH_ALREADY_USED');
            }

            const conflictingSession = await tx.checkoutSession.findFirst({
                where: {
                    OR: [{ pendingTxHash: normalizedTxHash }, { txHash: normalizedTxHash }],
                },
                select: { id: true },
            });
            if (conflictingSession) {
                throw new Error('TXHASH_ALREADY_USED');
            }

            return tx.checkoutSession.create({
                data: {
                    merchantId: paywall.merchantId,
                    amount: paywall.price,
                    currency: paywall.currency,
                    description: paywall.name,
                    metadata: {
                        paywallId: id,
                        payerAddress: address,
                        pricingModel: paywall.pricingModel,
                        contentType: paywall.contentType,
                    },
                    pendingTxHash: normalizedTxHash,
                    status: 'verifying',
                    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
                },
            });
        });

        return apiSuccess({
            success: true,
            paywallId: id,
            sessionId: session.id,
            status: session.status,
        });
    } catch (error) {
        if (error instanceof Error && error.message === 'TXHASH_ALREADY_USED') {
            return errors.conflict('TXHASH_ALREADY_USED', 'Transaction hash already used');
        }
        return errors.internal();
    }
}
