import { prisma } from '@/lib/prisma';
import { confirmPaymentSchema, validateBody } from '@/lib/schemas';
import { errors, apiSuccess } from '@/lib/errors';
import { rateLimiters, checkRateLimit } from '@/lib/rate-limit';
import { paymentLogger } from '@/lib/logger';
import { normalizePayerInfoConfig, normalizePayerInfoValues, validatePayerInfo } from '@/lib/payer-info';
import { toPrismaNullableJson } from '@/lib/prisma-json';

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({}));
        const validated = validateBody(confirmPaymentSchema, body);
        if (!validated.success) return validated.error;

        const {
            sessionId,
            txHash: rawHash,
            payerAddress,
            customerEmail,
            subscriptionConsentAccepted,
            payerInfo,
        } = validated.data;
        const normalizedHash = rawHash.toLowerCase();

        // Rate limit per session
        const { limited } = await checkRateLimit(rateLimiters.confirm, sessionId);
        if (limited) return errors.rateLimited();

        const session = await prisma.checkoutSession.findUnique({
            where: { id: sessionId },
            include: { product: true },
        });
        if (!session) return errors.notFound('Session');

        const metadata =
            session.metadata && typeof session.metadata === 'object'
                ? (session.metadata as Record<string, unknown>)
                : {};
        const payerInfoConfig = normalizePayerInfoConfig(
            session.payerInfoConfig || metadata.payerInfoConfig,
        );
        const existingPayerInfo = normalizePayerInfoValues(
            session.payerInfo || metadata.payerInfoValues,
        );
        const payerInfoValidation = validatePayerInfo(
            payerInfoConfig,
            payerInfo || existingPayerInfo || null,
        );
        if (!payerInfoValidation.ok) {
            return errors.validation(payerInfoValidation.errors);
        }
        const normalizedPayerInfo = payerInfoValidation.normalized;
        const resolvedCustomerEmail =
            normalizedPayerInfo?.email ||
            customerEmail ||
            session.customerEmail ||
            (typeof metadata.customerEmail === 'string' ? metadata.customerEmail : null);
        const isRecurringProduct =
            session.product?.billingType === 'subscription' ||
            metadata.billingType === 'subscription';

        if (isRecurringProduct) {
            if (subscriptionConsentAccepted !== true && metadata.subscriptionConsentAccepted !== true) {
                return errors.validation({
                    subscriptionConsentAccepted: ['Recurring products require billing consent'],
                });
            }

            if (!payerAddress && !session.customerAddress && typeof metadata.payerAddress !== 'string') {
                return errors.validation({
                    payerAddress: ['Recurring products require a payer wallet address'],
                });
            }
        }

        paymentLogger.info({ sessionId, merchantId: session.merchantId }, 'Payment confirmation started');

        // Idempotency — same session + same hash is a safe retry
        if (session.pendingTxHash === normalizedHash || session.txHash === normalizedHash) {
            return apiSuccess({ status: session.status, sessionId });
        }

        if (session.status !== 'pending') {
            return errors.conflict('SESSION_ALREADY_CONFIRMED', `Session is already ${session.status}`);
        }

        if (session.expiresAt < new Date()) {
            await prisma.checkoutSession.update({ where: { id: sessionId }, data: { status: 'expired' } });
            return errors.gone('Checkout session has expired');
        }

        const existingTx = await prisma.transaction.findUnique({ where: { txHash: normalizedHash } });
        if (existingTx) return errors.conflict('TXHASH_ALREADY_USED', 'Transaction hash already used');

        const conflictingSession = await prisma.checkoutSession.findFirst({
            where: { pendingTxHash: normalizedHash, id: { not: sessionId } }
        });
        if (conflictingSession) {
            return errors.conflict('TXHASH_IN_ANOTHER_SESSION', 'Transaction hash already submitted to another session');
        }

        await prisma.checkoutSession.update({
            where: { id: sessionId },
            data: {
                pendingTxHash: normalizedHash,
                status: 'verifying',
                customerEmail: resolvedCustomerEmail,
                customerAddress: payerAddress?.toLowerCase() || session.customerAddress || null,
                payerInfo: toPrismaNullableJson(normalizedPayerInfo),
                metadata: {
                    ...metadata,
                    ...(resolvedCustomerEmail ? { customerEmail: resolvedCustomerEmail } : {}),
                    ...(payerAddress ? { payerAddress: payerAddress.toLowerCase() } : {}),
                    ...(normalizedPayerInfo ? { payerInfoValues: normalizedPayerInfo } : {}),
                    ...(subscriptionConsentAccepted === true ? { subscriptionConsentAccepted: true } : {}),
                },
            }
        });

        paymentLogger.info({ sessionId, txHash: normalizedHash }, 'On-chain verification started');
        return apiSuccess({ status: 'verifying', sessionId });

    } catch (error) {
        paymentLogger.error({ err: error }, 'Payment confirmation error');
        return errors.internal();
    }
}
