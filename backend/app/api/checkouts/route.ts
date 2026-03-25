import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateApiKey } from '@/lib/api-auth';
import { createCheckoutSchema, validateBody } from '@/lib/schemas';
import { errors, apiSuccess } from '@/lib/errors';
import { rateLimiters, checkRateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { toPrismaJson, toPrismaNullableJson } from '@/lib/prisma-json';
import { getSettlementToken } from '@/lib/chain';
import { validateWebhookUrl } from '@/lib/ssrf';

export async function POST(request: Request) {
    try {
        const keyRecord = await validateApiKey(request);
        if (!keyRecord) return errors.unauthorized('Invalid or missing API Key');

        // Rate limit: 10 checkout creations per minute per API key
        const { limited, headers: rlHeaders } = await checkRateLimit(rateLimiters.checkout, keyRecord.id);
        if (limited) return NextResponse.json(
            { error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' } },
            { status: 429, headers: rlHeaders }
        );

        const body = await request.json().catch(() => ({}));
        const validated = validateBody(createCheckoutSchema, body);
        if (!validated.success) return validated.error;

        const {
            amount, currency,
            productId, productName, productDescription, productImage,
            description, redirectUrl, callbackUrl, splitConfigId, metadata, payerInfo,
        } = validated.data;

        // Validate callbackUrl against SSRF blocklist (it's fetched server-side)
        if (callbackUrl) {
            const urlCheck = await validateWebhookUrl(callbackUrl);
            if (!urlCheck.valid) {
                return errors.validation({ callbackUrl: [urlCheck.reason || 'Invalid callback URL'] });
            }
        }

        const merchant = keyRecord.merchant;
        const linkedProduct = productId
            ? await prisma.product.findFirst({
                where: {
                    id: productId,
                    merchantId: merchant.id,
                    active: true,
                },
            })
            : null;

        if (productId && !linkedProduct) {
            return errors.notFound('Product');
        }

        // If splitConfigId provided, verify it belongs to this merchant
        if (splitConfigId) {
            const splitConfig = await prisma.splitConfig.findUnique({ where: { id: splitConfigId } });
            if (!splitConfig || splitConfig.merchantId !== merchant.id || !splitConfig.active) {
                return errors.notFound('Split config');
            }
        }

        const session = await prisma.checkoutSession.create({
            data: {
                merchantId: merchant.id,
                amount,
                currency: currency ?? getSettlementToken().symbol,
                productId: linkedProduct?.id ?? null,
                status: 'pending',
                description: linkedProduct?.name || productName || description || 'Coal Checkout',
                payerInfoConfig: toPrismaNullableJson(payerInfo),
                metadata: toPrismaJson({
                    // User-supplied metadata goes into a namespaced key so it cannot
                    // override system fields (billingType, splitConfigId, etc.)
                    ...(metadata ? { custom: metadata } : {}),
                    productId:          linkedProduct?.id ?? productId ?? null,
                    productName:        linkedProduct?.name ?? productName ?? null,
                    productDescription: linkedProduct?.description ?? productDescription ?? null,
                    productImage:       linkedProduct?.image ?? productImage ?? null,
                    billingType:        linkedProduct?.billingType ?? null,
                    billingInterval:    linkedProduct?.billingInterval ?? null,
                    billingIntervalCount: linkedProduct?.billingIntervalCount ?? null,
                    ...(splitConfigId && { splitConfigId }),
                    ...(payerInfo ? { payerInfoConfig: payerInfo } : {}),
                }),
                billingReason: linkedProduct?.billingType === 'subscription' ? 'subscription_initial' : 'one_time',
                redirectUrl:  redirectUrl  || null,
                callbackUrl:  callbackUrl  || null,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            }
        });

        const baseUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000';

        logger.info({ sessionId: session.id, productName: productName || null, amount, currency }, 'Checkout created');

        return apiSuccess({
            id:            session.id,
            url:           `${baseUrl}/pay/checkout/${session.id}`,
            status:        session.status,
            amount:        session.amount,
            currency:      session.currency,
            productName:   productName ?? null,
            expiresAt:     session.expiresAt,
            splitConfigId: splitConfigId ?? null,
        }, 201);

    } catch (error) {
        logger.error({ err: error }, 'Checkout API error');
        return errors.internal();
    }
}
