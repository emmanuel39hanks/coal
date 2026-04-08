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
            fundingIntentId,
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

        // Atomic txHash dedup + session update to prevent race conditions.
        // Re-checks status and expiry inside the transaction to close the
        // TOCTOU window between the checks above and the actual update.
        try {
            await prisma.$transaction(async (tx) => {
                const existingTx = await tx.transaction.findUnique({ where: { txHash: normalizedHash } });
                if (existingTx) throw new Error('TXHASH_ALREADY_USED');

                const conflictingSession = await tx.checkoutSession.findFirst({
                    where: { pendingTxHash: normalizedHash, id: { not: sessionId } }
                });
                if (conflictingSession) throw new Error('TXHASH_IN_ANOTHER_SESSION');

                // Optimistic re-check: ensure session is still pending and not expired
                const fresh = await tx.checkoutSession.findUnique({
                    where: { id: sessionId },
                    select: { status: true, expiresAt: true },
                });
                if (!fresh || fresh.status !== 'pending') throw new Error('SESSION_ALREADY_CONFIRMED');
                if (fresh.expiresAt < new Date()) throw new Error('SESSION_EXPIRED');

                await tx.checkoutSession.update({
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
            });
        } catch (txError) {
            const msg = txError instanceof Error ? txError.message : '';
            if (msg === 'TXHASH_ALREADY_USED') return errors.conflict('TXHASH_ALREADY_USED', 'Transaction hash already used');
            if (msg === 'TXHASH_IN_ANOTHER_SESSION') return errors.conflict('TXHASH_IN_ANOTHER_SESSION', 'Transaction hash already submitted to another session');
            if (msg === 'SESSION_ALREADY_CONFIRMED') return errors.conflict('SESSION_ALREADY_CONFIRMED', 'Session is no longer pending');
            if (msg === 'SESSION_EXPIRED') return errors.gone('Checkout session has expired');
            throw txError;
        }

        if (fundingIntentId) {
            await prisma.fundingIntent.updateMany({
                where: {
                    id: fundingIntentId,
                    checkoutSessionId: sessionId,
                },
                data: {
                    resumeState: 'settlement_submitted',
                },
            });
        }

        paymentLogger.info({ sessionId, txHash: normalizedHash }, 'On-chain verification started');

        // Trigger immediate async verification instead of waiting for cron
        const cronSecret = process.env.CRON_SECRET;
        if (cronSecret) {
            const baseUrl = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || '';
            const verifyUrl = baseUrl
                ? `${baseUrl}/api/cron/verify-payments`
                : `${new URL(request.url).origin}/api/cron/verify-payments`;
            fetch(verifyUrl, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${cronSecret}` },
            }).catch(() => null); // Fire-and-forget
        }

        return apiSuccess({ status: 'verifying', sessionId });

    } catch (error) {
        paymentLogger.error({ err: error }, 'Payment confirmation error');
        return errors.internal();
    }
}
