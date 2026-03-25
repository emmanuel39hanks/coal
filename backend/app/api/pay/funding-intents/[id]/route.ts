import { prisma } from '@/lib/prisma';
import { apiSuccess, errors } from '@/lib/errors';
import { checkRateLimit, getIP, rateLimiters } from '@/lib/rate-limit';
import { getMoonPayTestnetNotice } from '@/lib/moonpay';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { limited } = await checkRateLimit(rateLimiters.public, getIP(request));
  if (limited) return errors.rateLimited();

  const { id } = await context.params;
  const fundingIntent = await prisma.fundingIntent.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      provider: true,
      providerEnvironment: true,
      walletType: true,
      fundingAsset: true,
      targetSettlementAsset: true,
      gasReserve: true,
      routeEstimate: true,
      resumeState: true,
      currencyCode: true,
      quoteCurrencyAmount: true,
      baseCurrencyCode: true,
      lastProviderStatus: true,
      trackerUrl: true,
      completedAt: true,
      failedAt: true,
      failureReason: true,
      createdAt: true,
    },
  });

  if (!fundingIntent) return errors.notFound('Funding intent');

  return apiSuccess({
    id: fundingIntent.id,
    status: fundingIntent.status,
    provider: fundingIntent.provider,
    environment: fundingIntent.providerEnvironment,
    walletType: fundingIntent.walletType,
    fundingAsset: fundingIntent.fundingAsset,
    targetSettlementAsset: fundingIntent.targetSettlementAsset,
    gasReserve: fundingIntent.gasReserve?.toString() ?? null,
    routeEstimate: fundingIntent.routeEstimate,
    resumeState: fundingIntent.resumeState,
    currencyCode: fundingIntent.currencyCode,
    quoteCurrencyAmount: fundingIntent.quoteCurrencyAmount.toString(),
    baseCurrencyCode: fundingIntent.baseCurrencyCode,
    providerStatus: fundingIntent.lastProviderStatus,
    trackerUrl: fundingIntent.trackerUrl,
    completedAt: fundingIntent.completedAt,
    failedAt: fundingIntent.failedAt,
    failureReason: fundingIntent.failureReason,
    createdAt: fundingIntent.createdAt,
    testnetNotice: getMoonPayTestnetNotice(),
  });
}
