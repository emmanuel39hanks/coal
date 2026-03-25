import { prisma } from '@/lib/prisma';
import { apiError, apiSuccess, errors } from '@/lib/errors';
import { createFundingIntentSchema, validateBody } from '@/lib/schemas';
import { checkRateLimit, getIP, rateLimiters } from '@/lib/rate-limit';
import { paymentLogger } from '@/lib/logger';
import {
  buildMoonPayReturnUrl,
  buildMoonPayUrl,
  getMoonPayQuoteAmount,
  getMoonPayTestnetNotice,
  isMoonPayConfigured,
  moonPayConfig,
} from '@/lib/moonpay';
import { getSettlementToken } from '@/lib/chain';
import { toPrismaJson } from '@/lib/prisma-json';
import { env } from '@/lib/env';

const ACTIVE_STATUSES = ['pending', 'processing'] as const;

export async function POST(request: Request) {
  try {
    const { limited } = await checkRateLimit(rateLimiters.public, getIP(request));
    if (limited) return errors.rateLimited();

    if (!isMoonPayConfigured()) {
      return apiError('INVALID_OPERATION', 'Card funding is not configured yet', 503);
    }

    const body = await request.json().catch(() => ({}));
    const validated = validateBody(createFundingIntentSchema, body);
    if (!validated.success) return validated.error;

    const walletAddress = validated.data.walletAddress.toLowerCase();
    const settlementToken = getSettlementToken();

    const session = await prisma.checkoutSession.findUnique({
      where: { id: validated.data.sessionId },
      select: {
        id: true,
        merchantId: true,
        amount: true,
        currency: true,
        customerEmail: true,
        status: true,
        expiresAt: true,
      },
    });

    if (!session) return errors.notFound('Session');

    if (session.status === 'confirmed') {
      return errors.conflict('INVALID_OPERATION', 'This checkout session is already paid');
    }

    if (session.expiresAt < new Date()) {
      await prisma.checkoutSession.update({
        where: { id: session.id },
        data: { status: 'expired' },
      });
      return errors.gone('Checkout session has expired');
    }

    if (session.currency.toUpperCase() !== settlementToken.symbol.toUpperCase()) {
      return errors.conflict(
        'INVALID_OPERATION',
        `Card funding currently supports direct ${settlementToken.symbol} settlement only`,
      );
    }

    if (moonPayConfig.environment === 'production' && env.CHAIN_ENV === 'testnet') {
      return errors.conflict(
        'INVALID_OPERATION',
        'Live MoonPay funding is configured, but this Coal environment is still on Base Sepolia. Switch Coal to Base mainnet before using live card funding.',
      );
    }

    if (
      moonPayConfig.environment === 'production' &&
      !moonPayConfig.currencyCode.includes(settlementToken.symbol.toLowerCase())
    ) {
      return errors.conflict(
        'INVALID_OPERATION',
        `MoonPay is configured to deliver ${moonPayConfig.currencyCode}, but this checkout expects ${settlementToken.symbol}. Update MOONPAY_CURRENCY_CODE before enabling card funding.`,
      );
    }

    const existingIntent = await prisma.fundingIntent.findFirst({
      where: {
        checkoutSessionId: session.id,
        provider: 'moonpay',
        walletAddress,
        status: { in: [...ACTIVE_STATUSES] },
      },
      orderBy: { createdAt: 'desc' },
    });

    let fundingIntent = existingIntent;
    if (!fundingIntent) {
      fundingIntent = await prisma.fundingIntent.create({
        data: {
          checkoutSessionId: session.id,
          merchantId: session.merchantId,
          provider: 'moonpay',
          status: 'pending',
          walletAddress,
          baseCurrencyCode: moonPayConfig.baseCurrencyCode,
          currencyCode: moonPayConfig.currencyCode,
          quoteCurrencyAmount: session.amount,
          providerEnvironment: moonPayConfig.environment,
          customerEmail: session.customerEmail,
          metadata: toPrismaJson({
            checkoutSessionId: session.id,
            note: 'MoonPay funds the buyer wallet before Coal settlement completes onchain.',
          }),
        },
      });

      fundingIntent = await prisma.fundingIntent.update({
        where: { id: fundingIntent.id },
        data: {
          externalTransactionId: fundingIntent.id,
          externalCustomerId: session.customerEmail
            ? `coal:${session.id}:${session.customerEmail}`
            : `coal:${session.id}:${walletAddress.slice(2, 10)}`,
        },
      });

      await prisma.checkoutSession.update({
        where: { id: session.id },
        data: { paymentMode: 'fund_then_pay' },
      });
    }

    const url = buildMoonPayUrl({
      walletAddress,
      quoteCurrencyAmount: getMoonPayQuoteAmount(session.amount),
      externalTransactionId: fundingIntent.externalTransactionId || fundingIntent.id,
      externalCustomerId: fundingIntent.externalCustomerId || undefined,
      email: session.customerEmail,
      returnUrl: buildMoonPayReturnUrl(session.id, fundingIntent.id),
    });

    paymentLogger.info(
      {
        sessionId: session.id,
        fundingIntentId: fundingIntent.id,
        provider: 'moonpay',
        environment: moonPayConfig.environment,
      },
      'Created card funding intent',
    );

    return apiSuccess({
      fundingIntentId: fundingIntent.id,
      status: fundingIntent.status,
      provider: 'moonpay',
      environment: moonPayConfig.environment,
      currencyCode: moonPayConfig.currencyCode,
      url,
      note: 'MoonPay funds the buyer wallet. Coal only completes the payment after an onchain wallet transfer is signed.',
      testnetNotice: getMoonPayTestnetNotice(),
    });
  } catch (error) {
    paymentLogger.error({ err: error }, 'Create funding intent error');
    return errors.internal();
  }
}
