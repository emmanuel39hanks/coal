import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/privy';
import { capturePayment } from '@/lib/commerce-payments';
import { errors, apiSuccess } from '@/lib/errors';
import { z } from 'zod';
import { validateBody } from '@/lib/schemas';
import { logger } from '@/lib/logger';
import { getSettlementToken } from '@/lib/chain';
import { amountToRawUnits } from '@/lib/validation';

const schema = z.object({ sessionId: z.string() });

export async function POST(request: Request) {
  try {
    const user = await getAuthUser(request);
    if (!user) return errors.unauthorized();

    const body = await request.json().catch(() => ({}));
    const validated = validateBody(schema, body);
    if (!validated.success) return validated.error;

    const session = await prisma.checkoutSession.findUnique({
      where: { id: validated.data.sessionId },
      include: { merchant: { select: { id: true, payoutAddress: true } } },
    });

    if (!session || session.merchantId !== user.id) return errors.notFound('Session');
    if (session.paymentMode !== 'authorize_capture') return errors.conflict('INVALID_OPERATION', 'Session is not in authorize_capture mode');
    if (session.status !== 'authorized') return errors.conflict('SESSION_ALREADY_CONFIRMED', `Session status is ${session.status}`);
    if (!session.authId) return errors.conflict('INVALID_OPERATION', 'No authorization ID found');
    if (!session.merchant.payoutAddress) return errors.conflict('INVALID_OPERATION', 'No payout address configured');

    const settlementToken = getSettlementToken();
    const txHash = await capturePayment(
      session.authId as `0x${string}`,
      amountToRawUnits(session.amount.toString(), settlementToken.decimals),
      session.merchant.payoutAddress as `0x${string}`
    );

    await prisma.checkoutSession.update({
      where: { id: session.id },
      data: { status: 'confirmed', capturedAt: new Date(), txHash: txHash as string },
    });

    return apiSuccess({ txHash, sessionId: session.id });
  } catch (err) {
    logger.error({ err }, 'Capture error');
    return errors.internal();
  }
}
