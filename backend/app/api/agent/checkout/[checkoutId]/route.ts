import { prisma } from '@/lib/prisma';
import { errors, apiSuccess } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { validateApiKey } from '@/lib/api-auth';

const FRONTEND_URL = process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000';

export async function GET(request: Request, { params }: { params: Promise<{ checkoutId: string }> }) {
  try {
    const apiKey = await validateApiKey(request);
    if (!apiKey) return errors.unauthorized('Invalid or missing API Key');

    const { checkoutId } = await params;
    const session = await prisma.checkoutSession.findFirst({
      where: { id: checkoutId, merchantId: apiKey.merchantId },
      select: { id: true, status: true, amount: true, currency: true, description: true, expiresAt: true, txHash: true },
    });

    if (!session) return errors.notFound('Checkout session not found');

    return apiSuccess({
      checkoutId: session.id,
      paymentUrl: `${FRONTEND_URL}/pay/checkout/${session.id}`,
      status: session.status,
      amount: session.amount,
      currency: session.currency,
      description: session.description,
      expiresAt: session.expiresAt,
      txHash: session.txHash,
    });
  } catch (err) {
    logger.error({ err }, 'Agent checkout status error');
    return errors.internal();
  }
}
