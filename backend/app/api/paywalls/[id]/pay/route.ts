import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { errors, apiSuccess } from '@/lib/errors';
import { rateLimiters, checkRateLimit, getIP } from '@/lib/rate-limit';
import { validateBody } from '@/lib/schemas';

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

        const body = await request.json().catch(() => ({}));
        const validated = validateBody(payPaywallSchema, body);
        if (!validated.success) return validated.error;

        const { address, txHash } = validated.data;

        const paywall = await prisma.paywall.findUnique({ where: { id } });
        if (!paywall || !paywall.active) {
            return errors.notFound('Paywall');
        }

        // Check txHash not already claimed anywhere in Coal
        const existingTx = await prisma.transaction.findUnique({
            where: { txHash },
        });
        if (existingTx) {
            return errors.conflict('TXHASH_ALREADY_USED', 'Transaction hash already used');
        }

        const conflictingSession = await prisma.checkoutSession.findFirst({
            where: {
                OR: [{ pendingTxHash: txHash.toLowerCase() }, { txHash: txHash.toLowerCase() }],
            },
            select: { id: true },
        });
        if (conflictingSession) {
            return errors.conflict('TXHASH_ALREADY_USED', 'Transaction hash already used');
        }

        const session = await prisma.checkoutSession.create({
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
                pendingTxHash: txHash.toLowerCase(),
                status: 'verifying',
                expiresAt: new Date(Date.now() + 30 * 60 * 1000),
            },
        });

        return apiSuccess({
            success: true,
            paywallId: id,
            sessionId: session.id,
            status: session.status,
        });
    } catch {
        return errors.internal();
    }
}
