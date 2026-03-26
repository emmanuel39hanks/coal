import { prisma } from '@/lib/prisma';
import { createSessionSchema, validateBody } from '@/lib/schemas';
import { errors, apiSuccess } from '@/lib/errors';
import { rateLimiters, checkRateLimit, getIP } from '@/lib/rate-limit';
import { validateAmount } from '@/lib/validation';
import { logger } from '@/lib/logger';
import { getSettlementToken } from '@/lib/chain';
import { normalizePayerInfoConfig, validatePayerInfo } from '@/lib/payer-info';
import { toPrismaNullableJson } from '@/lib/prisma-json';

export async function POST(request: Request) {
    try {
        const { limited } = await checkRateLimit(rateLimiters.public, getIP(request));
        if (limited) return errors.rateLimited();

        const body = await request.json().catch(() => ({}));
        const validated = validateBody(createSessionSchema, body);
        if (!validated.success) return validated.error;

        const { linkId, amount, customerEmail, subscriptionConsentAccepted, payerInfo } = validated.data;
        const settlementToken = getSettlementToken();

        const link = await prisma.paymentLink.findUnique({
            where: { id: linkId },
            include: { product: true }
        });
        if (!link || !link.active) return errors.notFound('Link');

        // Check link expiration and usage limits
        if (link.expiresAt && link.expiresAt < new Date()) {
            return errors.gone('This payment link has expired');
        }
        if (link.maxUses && link.useCount >= link.maxUses) {
            return errors.gone('This payment link has reached its usage limit');
        }

        const payerInfoConfig = normalizePayerInfoConfig(link.payerInfoConfig);

        let sessionAmount: number;
        if (link.product) {
            const parsed = validateAmount(link.product.price.toString());
            if (parsed === null) return errors.internal('Product has an invalid price');
            sessionAmount = parsed;
            if (link.product.billingType === 'subscription' && subscriptionConsentAccepted !== true) {
                return errors.validation({
                    subscriptionConsentAccepted: ['Recurring products require billing consent'],
                });
            }
        } else {
            if (amount === undefined) {
                return errors.validation({ amount: ['Amount required for flexible link'] });
            }
            sessionAmount = amount;
        }

        const payerInfoValidation = validatePayerInfo(payerInfoConfig, payerInfo || null);
        if (!payerInfoValidation.ok) {
            return errors.validation(payerInfoValidation.errors);
        }
        const normalizedPayerInfo = payerInfoValidation.normalized;
        const resolvedCustomerEmail = normalizedPayerInfo?.email || customerEmail || null;

        const session = await prisma.checkoutSession.create({
            data: {
                merchantId:  link.merchantId,
                productId:   link.product?.id ?? null,
                amount:      sessionAmount,
                currency:    settlementToken.symbol,
                description: link.product ? link.product.name : (link.title || 'Payment'),
                customerEmail: resolvedCustomerEmail,
                payerInfoConfig: toPrismaNullableJson(payerInfoConfig),
                payerInfo: toPrismaNullableJson(normalizedPayerInfo),
                billingReason: link.product?.billingType === 'subscription' ? 'subscription_initial' : 'one_time',
                redirectUrl: link.redirectUrl || null,
                metadata: link.product
                    ? {
                        linkId: link.id,
                        productId: link.product.id,
                        productName: link.product.name,
                        productDescription: link.product.description,
                        productImage: link.product.image,
                        billingType: link.product.billingType,
                        billingInterval: link.product.billingInterval,
                        billingIntervalCount: link.product.billingIntervalCount,
                        customerEmail: resolvedCustomerEmail,
                        payerInfoValues: normalizedPayerInfo,
                        subscriptionConsentAccepted: subscriptionConsentAccepted === true,
                    }
                    : {
                        linkId: link.id,
                        customerEmail: resolvedCustomerEmail,
                        payerInfoValues: normalizedPayerInfo,
                    },
                status:      'pending',
                expiresAt:   new Date(Date.now() + 24 * 60 * 60 * 1000),
            }
        });

        return apiSuccess({ sessionId: session.id });

    } catch (error) {
        logger.error({ err: error }, 'Create session error');
        return errors.internal();
    }
}
