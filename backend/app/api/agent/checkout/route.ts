import { prisma } from '@/lib/prisma';
import { createCheckoutSchema, validateBody } from '@/lib/schemas';
import { errors, apiSuccess } from '@/lib/errors';
import { rateLimiters, checkRateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { validateApiKey } from '@/lib/api-auth';
import { toPrismaJson, toPrismaNullableJson } from '@/lib/prisma-json';
import { getSettlementToken } from '@/lib/chain';
import { validateWebhookUrl } from '@/lib/ssrf';

const FRONTEND_URL = process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000';

export async function POST(request: Request) {
  try {
    const apiKey = await validateApiKey(request);
    if (!apiKey) return errors.unauthorized('Invalid or missing API Key');

    const { limited } = await checkRateLimit(rateLimiters.checkout, apiKey.id);
    if (limited) return errors.rateLimited();

    const body = await request.json().catch(() => ({}));
    const validated = validateBody(createCheckoutSchema, body);
    if (!validated.success) return validated.error;

    const { amount, currency, description, metadata, redirectUrl, callbackUrl, payerInfo } = validated.data;

    if (callbackUrl) {
      const urlCheck = await validateWebhookUrl(callbackUrl);
      if (!urlCheck.valid) {
        return errors.validation({ callbackUrl: [urlCheck.reason || 'Invalid callback URL'] });
      }
    }

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min
    const session = await prisma.checkoutSession.create({
      data: {
        merchantId: apiKey.merchantId,
        amount,
        currency: currency || getSettlementToken().symbol,
        description,
        payerInfoConfig: toPrismaNullableJson(payerInfo),
        metadata: toPrismaJson({
          ...(metadata ? { custom: metadata } : {}),
          ...(payerInfo ? { payerInfoConfig: payerInfo } : {}),
        }),
        redirectUrl,
        callbackUrl,
        expiresAt,
      },
    });

    return apiSuccess({
      checkoutId: session.id,
      paymentUrl: `${FRONTEND_URL}/pay/checkout/${session.id}`,
      status: session.status,
      amount: session.amount,
      currency: session.currency,
      expiresAt: session.expiresAt,
    }, 201);
  } catch (err) {
    logger.error({ err }, 'Agent checkout error');
    return errors.internal();
  }
}
