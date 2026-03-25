import { prisma } from '@/lib/prisma';
import { errors, apiSuccess } from '@/lib/errors';
import { getIP, checkRateLimit, rateLimiters } from '@/lib/rate-limit';
import { savePayerInfoSchema, validateBody } from '@/lib/schemas';
import { normalizePayerInfoConfig, validatePayerInfo } from '@/lib/payer-info';
import { toPrismaNullableJson } from '@/lib/prisma-json';

export async function POST(request: Request) {
  const ip = getIP(request);
  const { limited } = await checkRateLimit(rateLimiters.checkout, ip);
  if (limited) return errors.rateLimited();

  const body = await request.json().catch(() => ({}));
  const validated = validateBody(savePayerInfoSchema, body);
  if (!validated.success) return validated.error;

  const session = await prisma.checkoutSession.findUnique({
    where: { id: validated.data.sessionId },
    select: {
      id: true,
      status: true,
      payerInfoConfig: true,
      payerInfo: true,
      metadata: true,
    },
  });

  if (!session) return errors.notFound('Session');
  if (session.status !== 'pending') {
    return errors.conflict('INVALID_OPERATION', 'Payer info can only be updated while the session is pending');
  }

  const metadata =
    session.metadata && typeof session.metadata === 'object'
      ? (session.metadata as Record<string, unknown>)
      : {};
  const payerInfoConfig = normalizePayerInfoConfig(
    session.payerInfoConfig || metadata.payerInfoConfig,
  );
  const payerInfoValidation = validatePayerInfo(payerInfoConfig, validated.data.payerInfo);
  if (!payerInfoValidation.ok) {
    return errors.validation(payerInfoValidation.errors);
  }

  const normalizedPayerInfo = payerInfoValidation.normalized;
  await prisma.checkoutSession.update({
    where: { id: session.id },
    data: {
      payerInfo: toPrismaNullableJson(normalizedPayerInfo),
      customerEmail: normalizedPayerInfo?.email || null,
      metadata: {
        ...metadata,
        ...(normalizedPayerInfo ? { payerInfoValues: normalizedPayerInfo } : {}),
        ...(normalizedPayerInfo?.email ? { customerEmail: normalizedPayerInfo.email } : {}),
      },
    },
  });

  return apiSuccess({
    sessionId: session.id,
    payerInfo: normalizedPayerInfo,
  });
}
