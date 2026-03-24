import { prisma } from '@/lib/prisma';
import { sendWebhook } from '@/lib/webhooks';
import { logger } from '@/lib/logger';
import {
  normalizePayerInfoConfig,
  normalizePayerInfoValues,
  type PayerInfoConfig,
  type PayerInfoValues,
} from '@/lib/payer-info';
import { toPrismaJson, toPrismaNullableJson } from '@/lib/prisma-json';

export const SUBSCRIPTION_PRODUCT_TYPE = 'subscription';
export const SUBSCRIPTION_ACTIVE_STATUSES = ['active', 'payment_due', 'past_due', 'paused'] as const;

type BillingInterval = 'day' | 'week' | 'month' | 'year';

type RecurringPayerProfile = {
  payerInfoConfig: PayerInfoConfig | null;
  payerInfoValues: PayerInfoValues | null;
};

function getFrontendBaseUrl() {
  return process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000';
}

function asJsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function normalizeCustomerAddress(address?: string | null) {
  return address?.trim().toLowerCase() || null;
}

export function addBillingInterval(start: Date, interval: string, intervalCount = 1) {
  const next = new Date(start);
  const count = Math.max(1, intervalCount);

  switch (interval as BillingInterval) {
    case 'day':
      next.setDate(next.getDate() + count);
      return next;
    case 'week':
      next.setDate(next.getDate() + count * 7);
      return next;
    case 'year':
      next.setFullYear(next.getFullYear() + count);
      return next;
    case 'month':
    default:
      next.setMonth(next.getMonth() + count);
      return next;
  }
}

export function normalizeRecurringPayerProfile({
  payerInfoConfig,
  payerInfo,
  metadata,
  customerEmail,
}: {
  payerInfoConfig?: unknown;
  payerInfo?: unknown;
  metadata?: unknown;
  customerEmail?: string | null;
}): RecurringPayerProfile {
  const metadataObject = asJsonObject(metadata);
  const normalizedConfig = normalizePayerInfoConfig(
    payerInfoConfig || metadataObject.payerInfoConfig,
  );
  const normalizedValues = normalizePayerInfoValues(
    payerInfo || metadataObject.payerInfoValues,
  );

  if (!normalizedConfig) {
    return {
      payerInfoConfig: null,
      payerInfoValues: null,
    };
  }

  const seededValues = normalizePayerInfoValues({
    ...(normalizedValues || {}),
    ...(normalizedConfig.fields.includes('email') && customerEmail
      ? { email: customerEmail }
      : {}),
  });

  return {
    payerInfoConfig: normalizedConfig,
    payerInfoValues: seededValues,
  };
}

function recurringPayerProfileMetadata(profile: RecurringPayerProfile) {
  return {
    ...(profile.payerInfoConfig ? { payerInfoConfig: profile.payerInfoConfig } : {}),
    ...(profile.payerInfoValues ? { payerInfoValues: profile.payerInfoValues } : {}),
  };
}

function mergeMetadata(base: unknown, updates: Record<string, unknown>) {
  return toPrismaJson({
    ...asJsonObject(base),
    ...updates,
  });
}

function recurringMetadata({
  product,
  customerEmail,
  customerAddress,
  invoiceId,
  sequenceNumber,
  billingReason,
  payerInfoConfig,
  payerInfoValues,
}: {
  product: {
    id: string;
    name: string;
    description: string | null;
    image: string | null;
    billingInterval: string | null;
    billingIntervalCount: number;
  };
  customerEmail?: string | null;
  customerAddress?: string | null;
  invoiceId?: string | null;
  sequenceNumber?: number | null;
  billingReason: string;
  payerInfoConfig?: PayerInfoConfig | null;
  payerInfoValues?: PayerInfoValues | null;
}) {
  return toPrismaJson({
    productId: product.id,
    productName: product.name,
    productDescription: product.description,
    productImage: product.image,
    billingType: SUBSCRIPTION_PRODUCT_TYPE,
    billingInterval: product.billingInterval,
    billingIntervalCount: product.billingIntervalCount,
    subscriptionConsentAccepted: true,
    recurring: true,
    billingReason,
    ...(customerEmail ? { customerEmail } : {}),
    ...(customerAddress ? { payerAddress: customerAddress } : {}),
    ...(invoiceId ? { invoiceId } : {}),
    ...(sequenceNumber ? { invoiceSequenceNumber: sequenceNumber } : {}),
    ...(payerInfoConfig ? { payerInfoConfig } : {}),
    ...(payerInfoValues ? { payerInfoValues } : {}),
  });
}

export async function syncSubscriptionAfterConfirmedPayment(args: {
  session: {
    id: string;
    merchantId: string;
    productId: string | null;
    amount: { toString(): string };
    currency: string;
    customerEmail: string | null;
    customerAddress: string | null;
    billingReason: string;
    metadata?: unknown;
    payerInfoConfig?: unknown;
    payerInfo?: unknown;
  };
  product: {
    id: string;
    name: string;
    description: string | null;
    image: string | null;
    billingType: string;
    billingInterval: string | null;
    billingIntervalCount: number;
  } | null;
  paidAt?: Date;
  customerAddress?: string | null;
  customerEmail?: string | null;
}) {
  const product = args.product;
  if (!product || product.billingType !== SUBSCRIPTION_PRODUCT_TYPE || !product.billingInterval) {
    return null;
  }
  const billingInterval = product.billingInterval;

  const paidAt = args.paidAt ?? new Date();
  const customerAddress = normalizeCustomerAddress(
    args.customerAddress || args.session.customerAddress,
  );
  const customerEmail = args.customerEmail || args.session.customerEmail || null;
  const recurringPayerProfile = normalizeRecurringPayerProfile({
    payerInfoConfig: args.session.payerInfoConfig,
    payerInfo: args.session.payerInfo,
    metadata: args.session.metadata,
    customerEmail,
  });

  if (!customerAddress) {
    return null;
  }

  return prisma.$transaction(async (tx) => {
    const linkedInvoice = await tx.subscriptionInvoice.findFirst({
      where: { checkoutSessionId: args.session.id },
      include: {
        subscription: true,
      },
    });

    if (linkedInvoice) {
      const updatedSubscription = await tx.subscription.update({
        where: { id: linkedInvoice.subscriptionId },
        data: {
          customerEmail,
          customerAddress,
          amount: args.session.amount.toString(),
          currency: args.session.currency,
          currentPeriodStart: linkedInvoice.periodStart,
          currentPeriodEnd: linkedInvoice.periodEnd,
          nextBillingAt: linkedInvoice.periodEnd,
          renewalCount: Math.max(linkedInvoice.subscription.renewalCount, linkedInvoice.sequenceNumber),
          lastPaidAt: paidAt,
          status: 'active',
          latestInvoiceId: linkedInvoice.id,
          pausedAt: null,
          metadata: mergeMetadata(linkedInvoice.subscription.metadata, {
            source: 'checkout',
            lastPaidSessionId: args.session.id,
            ...recurringPayerProfileMetadata(recurringPayerProfile),
          }),
        },
      });

      await tx.subscriptionInvoice.update({
        where: { id: linkedInvoice.id },
        data: {
          status: 'paid',
          paidAt,
        },
      });

      await tx.checkoutSession.update({
        where: { id: args.session.id },
        data: {
          subscriptionId: updatedSubscription.id,
          billingReason: 'subscription_renewal',
          customerEmail,
          customerAddress,
        },
      });

      return {
        type: 'renewal' as const,
        subscriptionId: updatedSubscription.id,
        invoiceId: linkedInvoice.id,
      };
    }

    const mandate = await tx.billingMandate.upsert({
      where: {
        merchantId_productId_customerAddress: {
          merchantId: args.session.merchantId,
          productId: product.id,
          customerAddress,
        },
      },
      update: {
        customerEmail,
        status: 'active',
        revokedAt: null,
        acceptedAt: paidAt,
        metadata: mergeMetadata(undefined, {
          source: 'checkout',
          sessionId: args.session.id,
          ...recurringPayerProfileMetadata(recurringPayerProfile),
        }),
      },
      create: {
        merchantId: args.session.merchantId,
        productId: product.id,
        customerAddress,
        customerEmail,
        status: 'active',
        acceptedAt: paidAt,
        metadata: {
          source: 'checkout',
          sessionId: args.session.id,
          ...recurringPayerProfileMetadata(recurringPayerProfile),
        },
      },
    });

    const existingSubscription = await tx.subscription.findFirst({
      where: {
        merchantId: args.session.merchantId,
        productId: product.id,
        customerAddress,
        status: {
          in: [...SUBSCRIPTION_ACTIVE_STATUSES],
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existingSubscription) {
      const latestInvoice = await tx.subscriptionInvoice.findFirst({
        where: { subscriptionId: existingSubscription.id },
        orderBy: { sequenceNumber: 'desc' },
        select: { sequenceNumber: true },
      });
      const periodStart =
        existingSubscription.currentPeriodEnd > paidAt ? existingSubscription.currentPeriodEnd : paidAt;
      const periodEnd = addBillingInterval(
        periodStart,
        existingSubscription.interval,
        existingSubscription.intervalCount,
      );
      const sequenceNumber = Math.max(existingSubscription.renewalCount, latestInvoice?.sequenceNumber || 0) + 1;

      const manualInvoice = await tx.subscriptionInvoice.create({
        data: {
          subscriptionId: existingSubscription.id,
          merchantId: existingSubscription.merchantId,
          sequenceNumber,
          amount: args.session.amount.toString(),
          currency: args.session.currency,
          status: 'paid',
          billingReason: 'manual',
          periodStart,
          periodEnd,
          dueAt: paidAt,
          paidAt,
          checkoutSessionId: args.session.id,
          hostedUrl: `${getFrontendBaseUrl()}/pay/checkout/${args.session.id}`,
          metadata: {
            source: 'checkout',
            sessionId: args.session.id,
          },
        },
      });

      const updatedSubscription = await tx.subscription.update({
        where: { id: existingSubscription.id },
        data: {
          mandateId: mandate.id,
          customerEmail,
          customerAddress,
          amount: args.session.amount.toString(),
          currency: args.session.currency,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          nextBillingAt: periodEnd,
          renewalCount: sequenceNumber,
          lastPaidAt: paidAt,
          latestInvoiceId: manualInvoice.id,
          status: 'active',
          pausedAt: null,
          metadata: mergeMetadata(existingSubscription.metadata, {
            source: 'checkout',
            lastPaidSessionId: args.session.id,
            ...recurringPayerProfileMetadata(recurringPayerProfile),
          }),
        },
      });

      await tx.checkoutSession.update({
        where: { id: args.session.id },
        data: {
          subscriptionId: updatedSubscription.id,
          billingReason: 'subscription_manual',
          customerEmail,
          customerAddress,
        },
      });

      return {
        type: 'manual' as const,
        subscriptionId: updatedSubscription.id,
        invoiceId: manualInvoice.id,
      };
    }

    const periodStart = paidAt;
    const periodEnd = addBillingInterval(periodStart, billingInterval, product.billingIntervalCount);

    const subscription = await tx.subscription.create({
      data: {
        merchantId: args.session.merchantId,
        productId: product.id,
        mandateId: mandate.id,
        customerAddress,
        customerEmail,
        amount: args.session.amount.toString(),
        currency: args.session.currency,
        interval: billingInterval,
        intervalCount: product.billingIntervalCount,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        nextBillingAt: periodEnd,
        renewalCount: 1,
        lastPaidAt: paidAt,
        status: 'active',
        metadata: {
          source: 'checkout',
          startedFromSessionId: args.session.id,
          ...recurringPayerProfileMetadata(recurringPayerProfile),
        },
      },
    });

    const initialInvoice = await tx.subscriptionInvoice.create({
      data: {
        subscriptionId: subscription.id,
        merchantId: subscription.merchantId,
        sequenceNumber: 1,
        amount: args.session.amount.toString(),
        currency: args.session.currency,
        status: 'paid',
        billingReason: 'initial',
        periodStart,
        periodEnd,
        dueAt: paidAt,
        paidAt,
        checkoutSessionId: args.session.id,
        hostedUrl: `${getFrontendBaseUrl()}/pay/checkout/${args.session.id}`,
        metadata: {
          source: 'checkout',
          sessionId: args.session.id,
        },
      },
    });

    await tx.subscription.update({
      where: { id: subscription.id },
      data: { latestInvoiceId: initialInvoice.id },
    });

    await tx.checkoutSession.update({
      where: { id: args.session.id },
      data: {
        subscriptionId: subscription.id,
        billingReason: 'subscription_initial',
        customerEmail,
        customerAddress,
      },
    });

    return {
      type: 'initial' as const,
      subscriptionId: subscription.id,
      invoiceId: initialInvoice.id,
    };
  });
}

export async function markSubscriptionInvoicePastDueBySessionId(sessionId: string) {
  const invoice = await prisma.subscriptionInvoice.findFirst({
    where: { checkoutSessionId: sessionId },
    include: {
      subscription: true,
    },
  });

  if (!invoice || invoice.status === 'paid' || invoice.status === 'canceled') {
    return null;
  }

  await prisma.$transaction([
    prisma.subscriptionInvoice.update({
      where: { id: invoice.id },
      data: { status: 'past_due' },
    }),
    prisma.subscription.update({
      where: { id: invoice.subscriptionId },
      data: {
        status: 'past_due',
        latestInvoiceId: invoice.id,
      },
    }),
  ]);

  return invoice.id;
}

export async function processDueSubscriptions() {
  const now = new Date();
  const cooldownBoundary = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const subscriptions = await prisma.subscription.findMany({
    where: {
      status: { in: ['active', 'past_due'] },
      nextBillingAt: { lte: now },
    },
    include: {
      product: true,
      merchant: {
        select: {
          id: true,
          webhookSecret: true,
          webhookUrl: true,
        },
      },
      latestInvoice: true,
    },
    orderBy: { nextBillingAt: 'asc' },
  });

  const results = { processed: 0, created: 0, skipped: 0, failed: 0 };

  for (const subscription of subscriptions) {
    try {
      if (!subscription.product.active || !subscription.product.billingInterval) {
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: { status: 'paused', pausedAt: now },
        });
        results.skipped++;
        continue;
      }

      if (subscription.latestInvoice?.status === 'open') {
        results.skipped++;
        continue;
      }

      if (
        subscription.latestInvoice?.status === 'past_due' &&
        subscription.latestInvoice.createdAt > cooldownBoundary
      ) {
        results.skipped++;
        continue;
      }

      const periodStart = subscription.nextBillingAt;
      const periodEnd = addBillingInterval(
        periodStart,
        subscription.interval,
        subscription.intervalCount,
      );
      const reusableInvoice = subscription.latestInvoice?.status === 'past_due'
        ? subscription.latestInvoice
        : null;
      const sequenceNumber = reusableInvoice
        ? reusableInvoice.sequenceNumber
        : Math.max(subscription.renewalCount, subscription.latestInvoice?.sequenceNumber || 0) + 1;
      const frontendBaseUrl = getFrontendBaseUrl();
      const recurringPayerProfile = normalizeRecurringPayerProfile({
        metadata: subscription.metadata,
        customerEmail: subscription.customerEmail,
      });

      const created = await prisma.$transaction(async (tx) => {
        const session = await tx.checkoutSession.create({
          data: {
            merchantId: subscription.merchantId,
            productId: subscription.productId,
            subscriptionId: subscription.id,
            amount: subscription.amount.toString(),
            currency: subscription.currency,
            description: `${subscription.product.name} renewal`,
            customerEmail: subscription.customerEmail,
            customerAddress: subscription.customerAddress,
            payerInfoConfig: toPrismaNullableJson(recurringPayerProfile.payerInfoConfig),
            payerInfo: toPrismaNullableJson(recurringPayerProfile.payerInfoValues),
            billingReason: 'subscription_renewal',
            metadata: recurringMetadata({
              product: subscription.product,
              customerEmail: subscription.customerEmail,
              customerAddress: subscription.customerAddress,
              billingReason: 'subscription_renewal',
              sequenceNumber,
              payerInfoConfig: recurringPayerProfile.payerInfoConfig,
              payerInfoValues: recurringPayerProfile.payerInfoValues,
            }),
            status: 'pending',
            expiresAt: new Date(now.getTime() + 72 * 60 * 60 * 1000),
          },
        });

        const invoice = reusableInvoice
          ? await tx.subscriptionInvoice.update({
              where: { id: reusableInvoice.id },
              data: {
                status: 'open',
                checkoutSessionId: session.id,
                hostedUrl: `${frontendBaseUrl}/pay/checkout/${session.id}`,
                dueAt: subscription.nextBillingAt,
                lastNotifiedAt: now,
                metadata: {
                  ...(reusableInvoice.metadata && typeof reusableInvoice.metadata === 'object'
                    ? reusableInvoice.metadata
                    : {}),
                  retriedAt: now.toISOString(),
                },
              },
            })
          : await tx.subscriptionInvoice.create({
              data: {
                subscriptionId: subscription.id,
                merchantId: subscription.merchantId,
                sequenceNumber,
                amount: subscription.amount.toString(),
                currency: subscription.currency,
                status: 'open',
                billingReason: 'renewal',
                periodStart,
                periodEnd,
                dueAt: subscription.nextBillingAt,
                checkoutSessionId: session.id,
                hostedUrl: `${frontendBaseUrl}/pay/checkout/${session.id}`,
                lastNotifiedAt: now,
                metadata: {
                  autoGenerated: true,
                  generatedAt: now.toISOString(),
                },
              },
            });

        await tx.checkoutSession.update({
          where: { id: session.id },
          data: {
            metadata: recurringMetadata({
              product: subscription.product,
              customerEmail: subscription.customerEmail,
              customerAddress: subscription.customerAddress,
              invoiceId: invoice.id,
              sequenceNumber,
              billingReason: 'subscription_renewal',
              payerInfoConfig: recurringPayerProfile.payerInfoConfig,
              payerInfoValues: recurringPayerProfile.payerInfoValues,
            }),
          },
        });

        await tx.subscription.update({
          where: { id: subscription.id },
          data: {
            status: 'payment_due',
            latestInvoiceId: invoice.id,
          },
        });

        return { invoice, session };
      });

      if (subscription.merchant.webhookUrl && subscription.merchant.webhookSecret) {
        await sendWebhook(
          subscription.merchant.webhookUrl,
          {
            event: 'subscription.renewal.created',
            data: {
              subscriptionId: subscription.id,
              invoiceId: created.invoice.id,
              checkoutSessionId: created.session.id,
              amount: created.invoice.amount,
              currency: created.invoice.currency,
              hostedUrl: created.invoice.hostedUrl,
              dueAt: created.invoice.dueAt,
              periodStart: created.invoice.periodStart,
              periodEnd: created.invoice.periodEnd,
            },
          },
          subscription.merchant.webhookSecret,
          subscription.merchant.id,
        );
      }

      results.processed++;
      results.created++;
    } catch (error) {
      logger.error({ err: error, subscriptionId: subscription.id }, 'Failed to process due subscription');
      results.processed++;
      results.failed++;
    }
  }

  return results;
}
