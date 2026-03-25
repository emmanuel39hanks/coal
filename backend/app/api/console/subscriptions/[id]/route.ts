import { getAuthUser, hasWriteAccess } from '@/lib/privy';
import { prisma } from '@/lib/prisma';
import { errors, apiSuccess } from '@/lib/errors';
import { updateSubscriptionSchema, validateBody } from '@/lib/schemas';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthUser(request);
    if (!user) return errors.unauthorized();
    if (!hasWriteAccess(user)) return errors.forbidden();

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const validated = validateBody(updateSubscriptionSchema, body);
    if (!validated.success) return validated.error;

    const subscription = await prisma.subscription.findUnique({
      where: { id },
      include: {
        latestInvoice: true,
      },
    });

    if (!subscription || subscription.merchantId !== user.id) {
      return errors.notFound('Subscription');
    }

    const now = new Date();
    const { action } = validated.data;

    if (action === 'pause') {
      const updated = await prisma.subscription.update({
        where: { id },
        data: {
          status: 'paused',
          pausedAt: now,
        },
      });

      return apiSuccess({ id: updated.id, status: updated.status });
    }

    if (action === 'resume') {
      const nextBillingAt =
        subscription.currentPeriodEnd > now ? subscription.currentPeriodEnd : now;
      const updated = await prisma.subscription.update({
        where: { id },
        data: {
          status: 'active',
          pausedAt: null,
          nextBillingAt,
        },
      });

      return apiSuccess({ id: updated.id, status: updated.status });
    }

    const updated = await prisma.subscription.update({
      where: { id },
      data: {
        status: 'canceled',
        canceledAt: now,
      },
    });

    if (subscription.latestInvoice?.status === 'open') {
      await prisma.subscriptionInvoice.update({
        where: { id: subscription.latestInvoice.id },
        data: { status: 'canceled' },
      });
    }

    return apiSuccess({ id: updated.id, status: updated.status });
  } catch {
    return errors.internal();
  }
}
