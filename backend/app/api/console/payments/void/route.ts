import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/privy';
import { voidPayment } from '@/lib/commerce-payments';
import { errors, apiSuccess } from '@/lib/errors';
import { z } from 'zod';
import { validateBody } from '@/lib/schemas';
import { logger } from '@/lib/logger';

const schema = z.object({ sessionId: z.string() });

export async function POST(request: Request) {
  try {
    const user = await getAuthUser(request);
    if (!user) return errors.unauthorized();

    const body = await request.json().catch(() => ({}));
    const validated = validateBody(schema, body);
    if (!validated.success) return validated.error;

    const session = await prisma.checkoutSession.findUnique({ where: { id: validated.data.sessionId } });
    if (!session || session.merchantId !== user.id) return errors.notFound('Session');
    if (session.status !== 'authorized') return errors.conflict('INVALID_OPERATION', `Cannot void session with status ${session.status}`);
    if (!session.authId) return errors.conflict('INVALID_OPERATION', 'No authorization ID found');

    await voidPayment(session.authId as `0x${string}`);
    await prisma.checkoutSession.update({
      where: { id: session.id },
      data: { status: 'voided', voidedAt: new Date() },
    });

    return apiSuccess({ sessionId: session.id, status: 'voided' });
  } catch (err) {
    logger.error({ err }, 'Void error');
    return errors.internal();
  }
}
