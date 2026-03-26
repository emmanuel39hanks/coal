import { getAuthUser } from '@/lib/privy';
import { prisma } from '@/lib/prisma';
import { errors, apiSuccess } from '@/lib/errors';
import { parsePaginationParams, paginatedMeta } from '@/lib/pagination';

function cadenceLabel(interval: string, intervalCount: number) {
  const suffix = intervalCount === 1 ? interval : `${interval}s`;
  return intervalCount === 1 ? `Every ${suffix}` : `Every ${intervalCount} ${suffix}`;
}

export async function GET(request: Request) {
  try {
    const user = await getAuthUser(request);
    if (!user) return errors.unauthorized();

    const url = new URL(request.url);
    const pagination = parsePaginationParams(url);
    const statusFilter = url.searchParams.get('status');

    const where: Record<string, unknown> = { merchantId: user.id };
    if (statusFilter) where.status = statusFilter;

    const [subscriptions, total, summaryAgg] = await Promise.all([
      prisma.subscription.findMany({
        where,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              billingType: true,
              billingInterval: true,
              billingIntervalCount: true,
            },
          },
          mandate: {
            select: {
              id: true,
              status: true,
              acceptedAt: true,
            },
          },
          latestInvoice: {
            select: {
              id: true,
              status: true,
              hostedUrl: true,
              dueAt: true,
              paidAt: true,
              sequenceNumber: true,
              amount: true,
              currency: true,
            },
          },
        },
        orderBy: [{ updatedAt: 'desc' }],
        skip: pagination.skip,
        take: pagination.take,
      }),
      prisma.subscription.count({ where }),
      // Summary always uses full dataset (not paginated)
      prisma.subscription.findMany({
        where: { merchantId: user.id },
        select: { status: true, amount: true },
      }),
    ]);

    const summary = summaryAgg.reduce(
      (acc, subscription) => {
        if (subscription.status === 'active') {
          acc.active += 1;
          acc.scheduledRevenue += Number(subscription.amount.toString());
        }
        if (subscription.status === 'payment_due' || subscription.status === 'past_due') {
          acc.actionRequired += 1;
        }
        if (subscription.status === 'paused') acc.paused += 1;
        if (subscription.status === 'canceled') acc.canceled += 1;
        return acc;
      },
      { active: 0, actionRequired: 0, paused: 0, canceled: 0, scheduledRevenue: 0 },
    );

    return apiSuccess({
      summary: {
        ...summary,
        scheduledRevenue: summary.scheduledRevenue.toFixed(2),
      },
      subscriptions: subscriptions.map((subscription) => ({
        id: subscription.id,
        status: subscription.status,
        amount: subscription.amount.toString(),
        currency: subscription.currency,
        customerAddress: subscription.customerAddress,
        customerEmail: subscription.customerEmail,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        nextBillingAt: subscription.nextBillingAt,
        lastPaidAt: subscription.lastPaidAt,
        renewalCount: subscription.renewalCount,
        cadenceLabel: cadenceLabel(subscription.interval, subscription.intervalCount),
        product: {
          id: subscription.product.id,
          name: subscription.product.name,
        },
        mandate: subscription.mandate,
        latestInvoice: subscription.latestInvoice
          ? {
              ...subscription.latestInvoice,
              amount: subscription.latestInvoice.amount.toString(),
            }
          : null,
      })),
      pagination: paginatedMeta(total, pagination),
    });
  } catch {
    return errors.internal();
  }
}
