import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/privy';
import { refundPayment } from '@/lib/commerce-payments';
import { errors, apiSuccess } from '@/lib/errors';
import { z } from 'zod';
import { validateBody } from '@/lib/schemas';
import { logger } from '@/lib/logger';
import { getSettlementToken } from '@/lib/chain';
import { amountToRawUnits } from '@/lib/validation';

const schema = z.object({ sessionId: z.string(), amount: z.number().positive().optional() });

export async function POST(request: Request) {
  try {
    const user = await getAuthUser(request);
    if (!user) return errors.unauthorized();

    const body = await request.json().catch(() => ({}));
    const validated = validateBody(schema, body);
    if (!validated.success) return validated.error;

    const session = await prisma.checkoutSession.findUnique({
      where: { id: validated.data.sessionId },
      include: { merchant: { select: { id: true } } },
    });
    if (!session || session.merchantId !== user.id) return errors.notFound('Session');
    if (session.status !== 'confirmed') return errors.conflict('INVALID_OPERATION', `Cannot refund session with status ${session.status}`);
    if (!session.authId) return errors.conflict('INVALID_OPERATION', 'No payment ID found for refund');

    const settlementToken = getSettlementToken();
    const refundAmountRaw = validated.data.amount
      ? amountToRawUnits(validated.data.amount, settlementToken.decimals)
      : amountToRawUnits(session.amount.toString(), settlementToken.decimals);

    // Refund to the original transaction sender (stored in transaction record)
    const tx = await prisma.transaction.findFirst({ where: { checkoutId: session.id } });
    const refundRecipient = (tx?.from ?? '0x0000000000000000000000000000000000000000') as `0x${string}`;

    await refundPayment(session.authId as `0x${string}`, refundAmountRaw, refundRecipient);
    await prisma.checkoutSession.update({
      where: { id: session.id },
      data: { status: 'refunded', refundedAt: new Date() },
    });

    return apiSuccess({ sessionId: session.id, status: 'refunded' });
  } catch (err) {
    logger.error({ err }, 'Refund error');
    return errors.internal();
  }
}
