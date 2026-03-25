import crypto from 'crypto';
import { env } from '@/lib/env';

export type MoonPayMode = 'sandbox' | 'production';
export type MoonPayFundingStatus = 'pending' | 'processing' | 'funded' | 'failed' | 'cancelled';
type MoonPayQuoteAvailability =
  | { ok: true }
  | { ok: false; message: string; code?: string; providerStatus?: number };

type MoonPayRecord = Record<string, unknown>;

function readEnv(key: string): string | undefined {
  const value = process.env[key]?.trim();
  return value ? value : undefined;
}

function asRecord(value: unknown): MoonPayRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as MoonPayRecord)
    : null;
}

function getString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function getNumberString(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toString();
  }

  return getString(value);
}

export const moonPayConfig = {
  enabled: Boolean(
    readEnv('MOONPAY_SECRET_KEY') &&
      (readEnv('MOONPAY_PUBLISHABLE_KEY') || readEnv('NEXT_PUBLIC_MOONPAY_API_KEY')),
  ),
  publishableKey:
    readEnv('MOONPAY_PUBLISHABLE_KEY') || readEnv('NEXT_PUBLIC_MOONPAY_API_KEY') || '',
  secretKey: readEnv('MOONPAY_SECRET_KEY') || '',
  webhookKey: readEnv('MOONPAY_WEBHOOK_API_KEY') || '',
  environment:
    (readEnv('MOONPAY_ENV') || readEnv('NEXT_PUBLIC_MOONPAY_ENV') || 'sandbox') === 'production'
      ? 'production'
      : 'sandbox',
  baseCurrencyCode: (readEnv('MOONPAY_BASE_CURRENCY_CODE') || 'usd').toLowerCase(),
  currencyCode: (
    readEnv('MOONPAY_CURRENCY_CODE') ||
    (env.CHAIN_ENV === 'testnet' ? readEnv('MOONPAY_SANDBOX_CURRENCY_CODE') || 'eth' : 'eth_base')
  ).toLowerCase(),
  colorCode: readEnv('MOONPAY_COLOR_CODE') || '#FF5C16',
  baseUrl:
    (readEnv('MOONPAY_ENV') || readEnv('NEXT_PUBLIC_MOONPAY_ENV') || 'sandbox') === 'production'
      ? 'https://buy.moonpay.com'
      : 'https://buy-sandbox.moonpay.com',
} as const;

export function isMoonPayConfigured() {
  return moonPayConfig.enabled;
}

export function getMoonPayTestnetNotice() {
  if (env.CHAIN_ENV !== 'testnet' || moonPayConfig.environment !== 'sandbox') {
    return null;
  }

  return 'MoonPay sandbox funds Sepolia test assets only. This validates the card-funding step, not a full Base Sepolia merchant settlement.';
}

export function getMoonPayFundingAsset() {
  return moonPayConfig.currencyCode;
}

export function buildMoonPayUrl(input: {
  walletAddress: string;
  quoteCurrencyAmount: string;
  externalTransactionId: string;
  externalCustomerId?: string;
  email?: string | null;
  returnUrl?: string | null;
}) {
  if (!moonPayConfig.enabled) {
    throw new Error('MoonPay is not configured');
  }

  const params = new URLSearchParams();
  params.append('apiKey', moonPayConfig.publishableKey);
  params.append('currencyCode', moonPayConfig.currencyCode);
  params.append('baseCurrencyCode', moonPayConfig.baseCurrencyCode);
  params.append('quoteCurrencyAmount', input.quoteCurrencyAmount);
  params.append('walletAddress', input.walletAddress);
  params.append('showWalletAddressForm', 'false');
  params.append('lockAmount', 'true');
  params.append('theme', 'light');
  params.append('language', 'en');
  params.append('colorCode', moonPayConfig.colorCode);
  params.append('externalTransactionId', input.externalTransactionId);

  if (input.externalCustomerId) {
    params.append('externalCustomerId', input.externalCustomerId);
  }
  if (input.email) {
    params.append('email', input.email);
  }
  if (input.returnUrl) {
    params.append('redirectURL', input.returnUrl);
  }

  const originalUrl = `${moonPayConfig.baseUrl}?${params.toString()}`;
  const signature = crypto
    .createHmac('sha256', moonPayConfig.secretKey)
    .update(new URL(originalUrl).search)
    .digest('base64');

  return `${originalUrl}&signature=${encodeURIComponent(signature)}`;
}

export function verifyMoonPayWebhookSignature(rawBody: string, headerValue: string | null) {
  if (!moonPayConfig.webhookKey) {
    throw new Error('MoonPay webhook key is not configured');
  }
  if (!headerValue) {
    return false;
  }

  const entries = headerValue.split(',').map((part) => part.trim());
  const timestamp = entries.find((part) => part.startsWith('t='))?.slice(2);
  const signature = entries.find((part) => part.startsWith('s='))?.slice(2);

  if (!timestamp || !signature) {
    return false;
  }

  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = crypto
    .createHmac('sha256', moonPayConfig.webhookKey)
    .update(signedPayload)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function normalizeMoonPayWebhook(payload: unknown): {
  eventType: string;
  providerStatus?: string;
  fundingStatus: MoonPayFundingStatus;
  eventId?: string;
  providerTransactionId?: string;
  externalTransactionId?: string;
  externalCustomerId?: string;
  walletAddress?: string;
  trackerUrl?: string;
  returnUrl?: string;
  failureReason?: string;
  customerEmail?: string;
} {
  const root = asRecord(payload) || {};
  const data = asRecord(root.data) || root;
  const eventType =
    getString(root.type, root.eventType, root.event, data.type, data.eventType, data.event) || 'transaction_updated';
  const providerStatus =
    getString(
      data.status,
      root.status,
      data.transactionStatus,
      root.transactionStatus,
      eventType,
    ) || 'unknown';
  const normalized = providerStatus.toLowerCase();

  let fundingStatus: MoonPayFundingStatus = 'pending';
  if (
    normalized.includes('complete') ||
    normalized.includes('deliver') ||
    normalized.includes('success') ||
    normalized.includes('finished')
  ) {
    fundingStatus = 'funded';
  } else if (
    normalized.includes('fail') ||
    normalized.includes('reject') ||
    normalized.includes('declin') ||
    normalized.includes('error')
  ) {
    fundingStatus = 'failed';
  } else if (
    normalized.includes('cancel') ||
    normalized.includes('expire')
  ) {
    fundingStatus = 'cancelled';
  } else if (
    normalized.includes('waiting') ||
    normalized.includes('pending') ||
    normalized.includes('kyc') ||
    normalized.includes('document') ||
    normalized.includes('processing') ||
    normalized.includes('review')
  ) {
    fundingStatus = 'processing';
  }

  const returnUrl =
    getString(data.returnUrl, data.widgetRedirectUrl) ||
    getString(asRecord(data.returnURL)?.url);

  return {
    eventType,
    providerStatus,
    fundingStatus,
    eventId: getString(root.id, data.id),
    providerTransactionId: getString(data.id, root.transactionId, root.id),
    externalTransactionId: getString(data.externalTransactionId, root.externalTransactionId),
    externalCustomerId: getString(data.externalCustomerId, root.externalCustomerId),
    walletAddress: getString(data.walletAddress, root.walletAddress),
    trackerUrl:
      getString(asRecord(data.returnURL)?.url, data.redirectUrl, root.redirectUrl),
    returnUrl,
    failureReason: getString(data.failureReason, root.failureReason),
    customerEmail: getString(data.email, root.email),
  };
}

export function getMoonPayQuoteAmount(amount: { toString(): string } | string | number) {
  if (typeof amount === 'string') return amount;
  if (typeof amount === 'number') return amount.toString();
  return amount.toString();
}

export function buildMoonPayReturnUrl(checkoutSessionId: string, fundingIntentId: string) {
  return `${env.APP_URL}/pay/checkout/${checkoutSessionId}?fundingIntentId=${fundingIntentId}`;
}

export async function checkMoonPayQuoteAvailability(input: {
  walletAddress: string;
  quoteCurrencyAmount: string;
  externalCustomerId?: string;
}): Promise<MoonPayQuoteAvailability> {
  if (!moonPayConfig.enabled) {
    return { ok: false, message: 'MoonPay is not configured' };
  }

  const params = new URLSearchParams({
    apiKey: moonPayConfig.publishableKey,
    currencyCode: moonPayConfig.currencyCode,
    baseCurrencyCode: moonPayConfig.baseCurrencyCode,
    quoteCurrencyAmount: input.quoteCurrencyAmount,
    areFeesIncluded: 'true',
    fixed: 'true',
    walletAddress: input.walletAddress,
  });

  if (input.externalCustomerId) {
    params.append('externalCustomerId', input.externalCustomerId);
  }

  const response = await fetch(`https://api.moonpay.com/v3/currencies/${moonPayConfig.currencyCode}/quote?${params.toString()}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });

  if (response.ok) {
    return { ok: true };
  }

  let payload: Record<string, unknown> | null = null;
  try {
    payload = (await response.json()) as Record<string, unknown>;
  } catch {
    payload = null;
  }

  return {
    ok: false,
    message:
      (typeof payload?.message === 'string' && payload.message) ||
      'MoonPay could not prepare a live quote for this checkout right now.',
    code: typeof payload?.moonPayErrorCode === 'string' ? payload.moonPayErrorCode : undefined,
    providerStatus: response.status,
  };
}
