import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { validateApiKey } from '@/lib/api-auth';
import { errors, apiSuccess } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { payerInfoConfigSchema } from '@/lib/payer-info';
import { toPrismaNullableJson } from '@/lib/prisma-json';
import { getSettlementToken } from '@/lib/chain';

const widgetSessionSchema = z.object({
    amount: z.number().positive('Amount must be a positive number'),
    currency: z.string().trim().min(2).max(16).optional().transform((value) => (value ?? getSettlementToken().symbol).toUpperCase()),
    description: z.string().optional(),
    redirectUrl: z.string().url().optional(),
    payerInfo: payerInfoConfigSchema.optional(),
});

export async function POST(request: Request) {
    try {
        const keyRecord = await validateApiKey(request);
        if (!keyRecord) return errors.unauthorized('Invalid or missing API Key');

        const body = await request.json().catch(() => ({}));
        const parsed = widgetSessionSchema.safeParse(body);

        if (!parsed.success) {
            return errors.validation(
                Object.fromEntries(
                    parsed.error.issues.map((e) => [e.path.join('.'), e.message])
                )
            );
        }

        const { amount, currency, description, redirectUrl, payerInfo } = parsed.data;
        const merchant = keyRecord.merchant;
        const payoutAddress = merchant.payoutAddress;

        const session = await prisma.checkoutSession.create({
            data: {
                merchantId: merchant.id,
                amount,
                currency,
                description: description || 'Widget Checkout',
                payerInfoConfig: toPrismaNullableJson(payerInfo),
                metadata: {
                    ...(payoutAddress ? { snapshotPayoutAddress: payoutAddress.toLowerCase() } : {}),
                },
                status: 'pending',
                redirectUrl: redirectUrl || null,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            },
        });

        const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://usecoal.xyz';

        return apiSuccess(
            {
                sessionId: session.id,
                checkoutUrl: `${frontendUrl}/embed/${session.id}`,
                expiresAt: session.expiresAt,
            },
            201
        );
    } catch (error) {
        logger.error({ err: error }, 'Widget session error');
        return errors.internal();
    }
}
