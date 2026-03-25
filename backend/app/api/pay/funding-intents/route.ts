import { parseUnits } from 'viem';
import { prisma } from '@/lib/prisma';
import { apiError, apiSuccess, errors } from '@/lib/errors';
import { createFundingIntentSchema, validateBody } from '@/lib/schemas';
import { checkRateLimit, getIP, rateLimiters } from '@/lib/rate-limit';
import { paymentLogger } from '@/lib/logger';
import {
  buildMoonPayReturnUrl,
  buildMoonPayUrl,
  checkMoonPayQuoteAvailability,
  getMoonPayFundingAsset,
  getMoonPayQuoteAmount,
  getMoonPayTestnetNotice,
  isMoonPayConfigured,
  moonPayConfig,
} from '@/lib/moonpay';
import { CHAIN_ID, getNativeFundingToken, getSettlementToken } from '@/lib/chain';
import { toPrismaJson } from '@/lib/prisma-json';
import { env } from '@/lib/env';
import { getPrivyIdentity } from '@/lib/privy';

const ACTIVE_STATUSES = ['pending', 'processing', 'funded'] as const;
const LI_FI_API_URL = 'https://li.quest/v1/quote/toAmount';

type FundingEstimate = {
  quoteCurrencyAmount: string;
  gasReserveUsd: string;
  routeEstimate: Record<string, unknown>;
};

function formatUsd(value: number) {
  return value.toFixed(2);
}

function buildFallbackFundingEstimate(sessionAmount: string, settlementSymbol: string): FundingEstimate {
  const amount = Number(sessionAmount) || 0;
  const slippageBufferUsd = Math.max(0.75, amount * 0.03);
  const gasReserveUsd = Math.max(1.5, amount * 0.05);
  const quoteCurrencyAmount = amount + slippageBufferUsd + gasReserveUsd;

  return {
    quoteCurrencyAmount: formatUsd(quoteCurrencyAmount),
    gasReserveUsd: gasReserveUsd.toFixed(6),
    routeEstimate: {
      strategy: 'buffered_fallback',
      settlementSymbol,
      estimatedSettlementAmount: sessionAmount,
      slippageBufferUsd: formatUsd(slippageBufferUsd),
      gasReserveUsd: formatUsd(gasReserveUsd),
      targetFundingUsd: formatUsd(quoteCurrencyAmount),
    },
  };
}

async function buildFundingEstimate(input: {
  walletAddress: string;
  payoutAddress: string;
  sessionAmount: string;
  settlementToken: ReturnType<typeof getSettlementToken>;
}) {
  const nativeFundingToken = getNativeFundingToken();
  const fallback = buildFallbackFundingEstimate(input.sessionAmount, input.settlementToken.symbol);

  try {
    const toAmount = parseUnits(input.sessionAmount, input.settlementToken.decimals).toString();
    const params = new URLSearchParams({
      fromChain: CHAIN_ID.toString(),
      toChain: CHAIN_ID.toString(),
      fromToken: nativeFundingToken.address,
      toToken: input.settlementToken.address,
      toAmount,
      fromAddress: input.walletAddress,
      toAddress: input.payoutAddress,
      order: 'CHEAPEST',
      slippage: '0.005',
      integrator: 'coal-payments',
    });

    const response = await fetch(`${LI_FI_API_URL}?${params.toString()}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`LiFi quote failed with ${response.status}`);
    }

    const quote = await response.json();
    const estimate = quote?.estimate || {};
    const routeAmountUsd = Number.parseFloat(String(estimate.fromAmountUSD || input.sessionAmount));
    const gasCosts = Array.isArray(estimate.gasCosts) ? estimate.gasCosts : [];
    const gasCostUsd = gasCosts.reduce((sum: number, cost: Record<string, unknown>) => {
      const next = Number.parseFloat(String(cost?.amountUSD || 0));
      return Number.isFinite(next) ? sum + next : sum;
    }, 0);
    const slippageBufferUsd = Math.max(0.75, routeAmountUsd * 0.03);
    const gasReserveUsd = Math.max(1.5, gasCostUsd + 0.5);
    const quoteCurrencyAmount = routeAmountUsd + slippageBufferUsd + gasReserveUsd;

    return {
      quoteCurrencyAmount: formatUsd(quoteCurrencyAmount),
      gasReserveUsd: gasReserveUsd.toFixed(6),
      routeEstimate: {
        strategy: 'lifi_to_amount_quote',
        tool: quote?.toolDetails?.name || null,
        settlementSymbol: input.settlementToken.symbol,
        estimatedSettlementAmount: input.sessionAmount,
        estimatedFundingAmountWei: quote?.action?.fromAmount || estimate?.fromAmount || null,
        estimatedFundingAmountUsd: formatUsd(routeAmountUsd),
        gasCostUsd: formatUsd(gasCostUsd),
        slippageBufferUsd: formatUsd(slippageBufferUsd),
        gasReserveUsd: formatUsd(gasReserveUsd),
        targetFundingUsd: formatUsd(quoteCurrencyAmount),
      },
    } satisfies FundingEstimate;
  } catch (error) {
    paymentLogger.warn(
      {
        err: error,
        walletAddress: input.walletAddress,
        settlementToken: input.settlementToken.symbol,
      },
      'LiFi funding estimate failed, falling back to a conservative USD reserve',
    );
    return fallback;
  }
}

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

    const fundingMode = validated.data.fundingMode ?? 'embedded';
    const privyIdentity = fundingMode === 'embedded' ? await getPrivyIdentity(request) : null;
    const embeddedWalletAddress = privyIdentity?.walletAddress || null;
    const walletAddress =
      (fundingMode === 'embedded' ? embeddedWalletAddress : null) ||
      validated.data.walletAddress?.toLowerCase() ||
      null;

    if (!walletAddress) {
      return apiError(
        'INVALID_OPERATION',
        fundingMode === 'embedded'
          ? 'Create or connect your Coal wallet before starting card funding.'
          : 'A destination wallet address is required for card funding.',
        401,
      );
    }

    const settlementToken = getSettlementToken();
    const fundingAsset = getMoonPayFundingAsset();

    if (moonPayConfig.environment === 'production' && env.CHAIN_ENV === 'testnet') {
      return errors.conflict(
        'INVALID_OPERATION',
        'Live MoonPay funding is configured, but this Coal environment is still on Base Sepolia. Switch Coal to Base mainnet before using live card funding.',
      );
    }

    const expectedFundingAsset = env.CHAIN_ENV === 'testnet' ? 'eth' : 'eth_base';
    if (fundingAsset !== expectedFundingAsset) {
      return errors.conflict(
        'INVALID_OPERATION',
        `MoonPay is configured to fund ${fundingAsset}, but Coal card checkout now funds ${expectedFundingAsset} first so the same embedded wallet has gas to finish the payment. Update MOONPAY_CURRENCY_CODE before enabling card funding.`,
      );
    }

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
        merchant: {
          select: {
            payoutAddress: true,
          },
        },
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

    if (!session.merchant?.payoutAddress) {
      return errors.conflict('INVALID_OPERATION', 'Merchant payout address is not configured yet');
    }

    const fundingEstimate = await buildFundingEstimate({
      walletAddress,
      payoutAddress: session.merchant.payoutAddress.toLowerCase(),
      sessionAmount: session.amount.toString(),
      settlementToken,
    });

    const existingIntent = await prisma.fundingIntent.findFirst({
      where: {
        checkoutSessionId: session.id,
        provider: 'moonpay',
        walletAddress,
        walletType: fundingMode,
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
          walletType: fundingMode,
          baseCurrencyCode: moonPayConfig.baseCurrencyCode,
          currencyCode: moonPayConfig.currencyCode,
          quoteCurrencyAmount: fundingEstimate.quoteCurrencyAmount,
          fundingAsset,
          targetSettlementAsset: `${settlementToken.symbol.toLowerCase()}_base`,
          gasReserve: fundingEstimate.gasReserveUsd,
          routeEstimate: toPrismaJson(fundingEstimate.routeEstimate),
          providerEnvironment: moonPayConfig.environment,
          customerEmail: session.customerEmail || privyIdentity?.email || null,
          resumeState: 'funding_pending',
          metadata: toPrismaJson({
            checkoutSessionId: session.id,
            note: 'MoonPay funds the buyer-owned Coal wallet first. Coal then settles the merchant payment from that wallet onchain.',
          }),
        },
      });

      fundingIntent = await prisma.fundingIntent.update({
        where: { id: fundingIntent.id },
        data: {
          externalTransactionId: fundingIntent.id,
          externalCustomerId: (session.customerEmail || privyIdentity?.email)
            ? `coal:${session.id}:${session.customerEmail || privyIdentity?.email}`
            : `coal:${session.id}:${walletAddress.slice(2, 10)}`,
        },
      });

      await prisma.checkoutSession.update({
        where: { id: session.id },
        data: { paymentMode: 'fund_then_pay' },
      });
    } else {
      fundingIntent = await prisma.fundingIntent.update({
        where: { id: fundingIntent.id },
        data: {
          quoteCurrencyAmount: fundingEstimate.quoteCurrencyAmount,
          targetSettlementAsset: `${settlementToken.symbol.toLowerCase()}_base`,
          gasReserve: fundingEstimate.gasReserveUsd,
          routeEstimate: toPrismaJson(fundingEstimate.routeEstimate),
          customerEmail: session.customerEmail || privyIdentity?.email || fundingIntent.customerEmail,
        },
      });
    }

    const quoteAvailability = await checkMoonPayQuoteAvailability({
      walletAddress,
      quoteCurrencyAmount: getMoonPayQuoteAmount(fundingEstimate.quoteCurrencyAmount),
      externalCustomerId: fundingIntent.externalCustomerId || undefined,
    });

    if (!quoteAvailability.ok) {
      paymentLogger.warn(
        {
          sessionId: session.id,
          fundingIntentId: fundingIntent.id,
          provider: 'moonpay',
          environment: moonPayConfig.environment,
          moonPayErrorCode: quoteAvailability.code,
          providerStatus: quoteAvailability.providerStatus,
        },
        'MoonPay quote preflight failed',
      );

      await prisma.fundingIntent.update({
        where: { id: fundingIntent.id },
        data: {
          status: 'failed',
          resumeState: 'funded_but_unsettled',
          failureReason: quoteAvailability.message,
        },
      });

      return apiError('INVALID_OPERATION', quoteAvailability.message, 503, {
        provider: 'moonpay',
        providerStatus: quoteAvailability.providerStatus,
        moonPayErrorCode: quoteAvailability.code,
      });
    }

    const url = buildMoonPayUrl({
      walletAddress,
      quoteCurrencyAmount: getMoonPayQuoteAmount(fundingEstimate.quoteCurrencyAmount),
      externalTransactionId: fundingIntent.externalTransactionId || fundingIntent.id,
      externalCustomerId: fundingIntent.externalCustomerId || undefined,
      email: session.customerEmail || privyIdentity?.email || null,
      returnUrl: buildMoonPayReturnUrl(session.id, fundingIntent.id),
    });

    paymentLogger.info(
      {
        sessionId: session.id,
        fundingIntentId: fundingIntent.id,
        provider: 'moonpay',
        environment: moonPayConfig.environment,
        walletType: fundingMode,
      },
      'Created card funding intent',
    );

    return apiSuccess({
      fundingIntentId: fundingIntent.id,
      status: fundingIntent.status,
      provider: 'moonpay',
      environment: moonPayConfig.environment,
      walletType: fundingIntent.walletType,
      fundingAsset: fundingIntent.fundingAsset,
      targetSettlementAsset: fundingIntent.targetSettlementAsset,
      gasReserve: fundingIntent.gasReserve?.toString() ?? null,
      routeEstimate: fundingIntent.routeEstimate,
      resumeState: fundingIntent.resumeState,
      currencyCode: moonPayConfig.currencyCode,
      url,
      note: 'MoonPay securely funds your Coal wallet first. Coal then completes the merchant payment from that same wallet onchain.',
      testnetNotice: getMoonPayTestnetNotice(),
    });
  } catch (error) {
    paymentLogger.error({ err: error }, 'Create funding intent error');
    return errors.internal();
  }
}
