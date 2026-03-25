import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { apiSuccess, errors } from '@/lib/errors';
import { moonPayConfig, normalizeMoonPayWebhook, verifyMoonPayWebhookSignature } from '@/lib/moonpay';
import { toPrismaJson } from '@/lib/prisma-json';
import { webhookLogger } from '@/lib/logger';

const TERMINAL_STATUSES = new Set(['funded', 'failed', 'cancelled']);

export async function POST(request: Request) {
  try {
    if (!moonPayConfig.webhookKey) {
      return errors.internal('MoonPay webhook verification is not configured');
    }

    const rawBody = await request.text();
    const signature =
      request.headers.get('moonpay-signature-v2') ||
      request.headers.get('Moonpay-Signature-V2');

    const signatureVerified = verifyMoonPayWebhookSignature(rawBody, signature);
    if (!signatureVerified) {
      return errors.unauthorized('Invalid MoonPay webhook signature');
    }

    const payload = JSON.parse(rawBody);
    const normalized = normalizeMoonPayWebhook(payload);

    const dedupeSeed =
      normalized.eventId ||
      `${normalized.providerTransactionId || 'unknown'}:${normalized.providerStatus || normalized.eventType}:${rawBody}`;
    const dedupeKey = crypto.createHash('sha256').update(dedupeSeed).digest('hex');

    let fundingIntent =
      (normalized.externalTransactionId
        ? await prisma.fundingIntent.findUnique({
            where: { externalTransactionId: normalized.externalTransactionId },
          })
        : null) ||
      (normalized.providerTransactionId
        ? await prisma.fundingIntent.findUnique({
            where: { providerTransactionId: normalized.providerTransactionId },
          })
        : null);

    await prisma.fundingWebhookEvent.upsert({
      where: { dedupeKey },
      update: {},
      create: {
        fundingIntentId: fundingIntent?.id || null,
        merchantId: fundingIntent?.merchantId || null,
        provider: 'moonpay',
        eventType: normalized.eventType,
        dedupeKey,
        externalEventId: normalized.eventId || null,
        externalTxId: normalized.providerTransactionId || normalized.externalTransactionId || null,
        signatureVerified,
        payload: toPrismaJson(payload),
      },
    });

    if (fundingIntent) {
      const currentStatus = fundingIntent.status;
      const nextStatus = TERMINAL_STATUSES.has(currentStatus)
        ? currentStatus
        : normalized.fundingStatus;

      fundingIntent = await prisma.fundingIntent.update({
        where: { id: fundingIntent.id },
        data: {
          status: nextStatus,
          providerTransactionId:
            normalized.providerTransactionId || fundingIntent.providerTransactionId || null,
          trackerUrl: normalized.trackerUrl || fundingIntent.trackerUrl || null,
          returnUrl: normalized.returnUrl || fundingIntent.returnUrl || null,
          customerEmail: normalized.customerEmail || fundingIntent.customerEmail || null,
          lastProviderStatus: normalized.providerStatus || normalized.eventType,
          failureReason:
            nextStatus === 'failed' || nextStatus === 'cancelled'
              ? normalized.failureReason || normalized.providerStatus || fundingIntent.failureReason || null
              : fundingIntent.failureReason,
          completedAt:
            nextStatus === 'funded' ? fundingIntent.completedAt || new Date() : fundingIntent.completedAt,
          failedAt:
            nextStatus === 'failed' || nextStatus === 'cancelled'
              ? fundingIntent.failedAt || new Date()
              : fundingIntent.failedAt,
          metadata: toPrismaJson({
            ...(fundingIntent.metadata && typeof fundingIntent.metadata === 'object'
              ? (fundingIntent.metadata as Record<string, unknown>)
              : {}),
            lastWebhookEventType: normalized.eventType,
            lastWebhookAt: new Date().toISOString(),
          }),
        },
      });
    }

    webhookLogger.info(
      {
        provider: 'moonpay',
        fundingIntentId: fundingIntent?.id || null,
        status: normalized.fundingStatus,
        providerStatus: normalized.providerStatus,
      },
      'Processed MoonPay webhook',
    );

    return apiSuccess({ received: true });
  } catch (error) {
    webhookLogger.error({ err: error }, 'MoonPay webhook error');
    return errors.internal();
  }
}
