import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateAmount } from '@/lib/validation';
import { errors, apiSuccess } from '@/lib/errors';
import { rateLimiters, checkRateLimit, getIP } from '@/lib/rate-limit';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { getSettlementToken } from '@/lib/chain';
import { toPrismaNullableJson } from '@/lib/prisma-json';

const schema = z.object({
    slug: z.string().min(1),
    amount: z.number().positive().optional(),
});

export async function POST(request: Request) {
    try {
        const { limited } = await checkRateLimit(rateLimiters.public, getIP(request));
        if (limited) return errors.rateLimited();

        const body = await request.json().catch(() => ({}));
        const parsed = schema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: { code: 'VALIDATION_ERROR', details: parsed.error.flatten().fieldErrors } },
                { status: 400 }
            );
        }

        const { slug, amount } = parsed.data;
        const settlementToken = getSettlementToken();

        const link = await prisma.paymentLink.findUnique({
            where: { slug },
            include: {
                product: true,
                merchant: { select: { name: true, payoutAddress: true } },
            },
        });

        if (!link || !link.active) return errors.notFound('Payment link');

        let sessionAmount: number;
        if (link.product) {
            const p = validateAmount(link.product.price.toString());
            if (p === null) return errors.internal('Product has invalid price');
            sessionAmount = p;
        } else {
            if (amount === undefined || amount <= 0) {
                return NextResponse.json(
                    { error: { code: 'VALIDATION_ERROR', details: { amount: ['Amount required for flexible link'] } } },
                    { status: 400 }
                );
            }
            sessionAmount = amount;
        }

        const session = await prisma.checkoutSession.create({
            data: {
                merchantId:  link.merchantId,
                amount:      sessionAmount.toString(),
                currency:    settlementToken.symbol,
                description: link.product?.name ?? (link.title ?? 'Payment'),
                productId:   link.product?.id ?? null,
                payerInfoConfig: toPrismaNullableJson(link.payerInfoConfig),
                status:      'pending',
                expiresAt:   new Date(Date.now() + 24 * 60 * 60 * 1000),
            },
        });

        return apiSuccess({
            sessionId:   session.id,
            amount:      sessionAmount,
            currency:    settlementToken.symbol,
            description: session.description,
            merchant:    link.merchant,
            expiresAt:   session.expiresAt,
        });

    } catch (error) {
        logger.error({ err: error }, 'checkout/init error');
        return errors.internal();
    }
}
