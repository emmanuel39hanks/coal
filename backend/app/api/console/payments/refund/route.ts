import { prisma } from '@/lib/prisma';
import { getAuthUser, hasWriteAccess } from '@/lib/privy';
import { refundPayment } from '@/lib/commerce-payments';
import { sendWebhook } from '@/lib/webhooks';
import { errors, apiSuccess } from '@/lib/errors';
import { z } from 'zod';
import { validateBody, amountField } from '@/lib/schemas';
import { logger } from '@/lib/logger';
import { getSettlementToken, EXPLORER_URL } from '@/lib/chain';
import { amountToRawUnits } from '@/lib/validation';

const schema = z.object({
  sessionId: z.string().min(1, 'Session ID required'),
  amount: amountField.optional(),
  reason: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  try {
    const user = await getAuthUser(request);
    if (!user) return errors.unauthorized();
    if (!hasWriteAccess(user)) return errors.forbidden();

    const body = await request.json().catch(() => ({}));
    const validated = validateBody(schema, body);
    if (!validated.success) return validated.error;

    const session = await prisma.checkoutSession.findUnique({
      where: { id: validated.data.sessionId },
      include: {
        merchant: { select: { id: true, webhookUrl: true, webhookSecret: true } },
        refunds: { where: { status: 'completed' }, select: { amount: true } },
      },
    });
    if (!session || session.merchantId !== user.id) return errors.notFound('Session');
    if (session.status !== 'confirmed' && session.status !== 'partially_refunded') {
      return errors.conflict('INVALID_OPERATION', `Cannot refund session with status ${session.status}`);
    }
    if (!session.authId) return errors.conflict('INVALID_OPERATION', 'No payment ID found for refund');

    // Calculate how much has already been refunded
    const totalRefunded = session.refunds.reduce(
      (sum, r) => sum + Number(r.amount),
      0,
    );
    const originalAmount = Number(session.amount);
    const remainingRefundable = originalAmount - totalRefunded;

    if (remainingRefundable <= 0) {
      return errors.conflict('INVALID_OPERATION', 'Session has already been fully refunded');
    }

    // Determine refund amount — full or partial
    const refundAmount = validated.data.amount ?? remainingRefundable;

    if (refundAmount > remainingRefundable) {
      return errors.validation({
        amount: [`Refund amount (${refundAmount}) exceeds remaining refundable amount (${remainingRefundable})`],
      });
    }

    // Find original payer address for the refund recipient
    const tx = await prisma.transaction.findFirst({ where: { checkoutId: session.id } });
    if (!tx?.from) {
      return errors.conflict('INVALID_OPERATION', 'No payer address found — cannot determine refund recipient');
    }
    const refundRecipient = tx.from as `0x${string}`;

    // Create the refund record before on-chain call
    const refund = await prisma.refund.create({
      data: {
        checkoutId: session.id,
        merchantId: user.id,
        amount: refundAmount,
        reason: validated.data.reason || null,
        status: 'pending',
        initiatedBy: user._callerId || user.id,
      },
    });

    try {
      const settlementToken = getSettlementToken();
      const refundAmountRaw = amountToRawUnits(refundAmount.toString(), settlementToken.decimals);

      const refundTxHash = await refundPayment(
        session.authId as `0x${string}`,
        refundAmountRaw,
        refundRecipient,
      );

      const isFullRefund = refundAmount === remainingRefundable;
      const newStatus = isFullRefund ? 'refunded' : 'partially_refunded';

      // Update refund record + session atomically
      await prisma.$transaction([
        prisma.refund.update({
          where: { id: refund.id },
          data: { status: 'completed', txHash: refundTxHash as string, completedAt: new Date() },
        }),
        prisma.checkoutSession.update({
          where: { id: session.id },
          data: {
            status: newStatus,
            ...(isFullRefund ? { refundedAt: new Date() } : {}),
          },
        }),
      ]);

      // Fire webhook
      if (session.merchant.webhookUrl && session.merchant.webhookSecret) {
        void sendWebhook(
          session.merchant.webhookUrl,
          {
            event: 'payment.refunded',
            data: {
              id: session.id,
              refundId: refund.id,
              amount: refundAmount.toString(),
              totalRefunded: (totalRefunded + refundAmount).toString(),
              originalAmount: originalAmount.toString(),
              currency: session.currency,
              status: newStatus,
              reason: validated.data.reason || null,
              txHash: refundTxHash,
              explorerUrl: `${EXPLORER_URL}/tx/${refundTxHash}`,
              refundRecipient,
            },
          },
          session.merchant.webhookSecret,
          session.merchantId,
        );
      }

      return apiSuccess({
        refundId: refund.id,
        sessionId: session.id,
        amount: refundAmount.toString(),
        status: newStatus,
        txHash: refundTxHash,
      });
    } catch (onChainError) {
      // On-chain call failed — mark refund as failed
      await prisma.refund.update({
        where: { id: refund.id },
        data: { status: 'failed' },
      });
      logger.error({ err: onChainError, refundId: refund.id }, 'On-chain refund failed');
      return errors.internal('Refund transaction failed on-chain');
    }
  } catch (err) {
    logger.error({ err }, 'Refund error');
    return errors.internal();
  }
}
