import crypto from 'crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalEnv = { ...process.env };

async function importMoonPay(chainEnv: '' | 'testnet' = 'testnet') {
  vi.resetModules();
  vi.doMock('@/lib/env', () => ({
    env: {
      CHAIN_ENV: chainEnv,
      APP_URL: 'http://localhost:3000',
    },
  }));

  return import('@/lib/moonpay');
}

describe('moonpay helpers', () => {
  beforeEach(() => {
    process.env = {
      ...originalEnv,
      MOONPAY_PUBLISHABLE_KEY: 'pk_test_example',
      MOONPAY_SECRET_KEY: 'sk_test_example',
      MOONPAY_WEBHOOK_API_KEY: 'whsec_example',
      MOONPAY_ENV: 'sandbox',
      MOONPAY_BASE_CURRENCY_CODE: 'usd',
      MOONPAY_SANDBOX_CURRENCY_CODE: 'eth',
    };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('builds a signed MoonPay URL for a buyer wallet funding intent', async () => {
    const { buildMoonPayUrl } = await importMoonPay('testnet');

    const url = buildMoonPayUrl({
      walletAddress: '0x1111111111111111111111111111111111111111',
      quoteCurrencyAmount: '25.50',
      externalTransactionId: 'fi_test_123',
      externalCustomerId: 'coal:customer:123',
      email: 'ada@example.com',
      returnUrl: 'http://localhost:3000/pay/checkout/cs_123?fundingIntentId=fi_test_123',
    });

    const parsed = new URL(url);

    expect(parsed.origin).toBe('https://buy-sandbox.moonpay.com');
    expect(parsed.searchParams.get('apiKey')).toBe('pk_test_example');
    expect(parsed.searchParams.get('currencyCode')).toBe('eth');
    expect(parsed.searchParams.get('baseCurrencyCode')).toBe('usd');
    expect(parsed.searchParams.get('quoteCurrencyAmount')).toBe('25.50');
    expect(parsed.searchParams.get('walletAddress')).toBe('0x1111111111111111111111111111111111111111');
    expect(parsed.searchParams.get('externalTransactionId')).toBe('fi_test_123');
    expect(parsed.searchParams.get('externalCustomerId')).toBe('coal:customer:123');
    expect(parsed.searchParams.get('email')).toBe('ada@example.com');
    expect(parsed.searchParams.get('redirectURL')).toBe('http://localhost:3000/pay/checkout/cs_123?fundingIntentId=fi_test_123');
    expect(parsed.searchParams.get('signature')).toBeTruthy();
  });

  it('verifies a valid MoonPay webhook signature', async () => {
    const { verifyMoonPayWebhookSignature } = await importMoonPay('testnet');

    const rawBody = JSON.stringify({
      type: 'transaction_updated',
      data: {
        id: 'tx_123',
        status: 'completed',
      },
    });
    // Use current timestamp — the staleness check rejects timestamps older than 5 minutes
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = crypto
      .createHmac('sha256', 'whsec_example')
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');

    expect(verifyMoonPayWebhookSignature(rawBody, `t=${timestamp},s=${signature}`)).toBe(true);
    expect(verifyMoonPayWebhookSignature(rawBody, `t=${timestamp},s=deadbeef`)).toBe(false);

    // Verify stale timestamps are rejected (replay protection)
    const staleTimestamp = '1711111111';
    const staleSig = crypto
      .createHmac('sha256', 'whsec_example')
      .update(`${staleTimestamp}.${rawBody}`)
      .digest('hex');
    expect(verifyMoonPayWebhookSignature(rawBody, `t=${staleTimestamp},s=${staleSig}`)).toBe(false);
  });

  it('normalizes funded and failed webhook payloads into Coal funding states', async () => {
    const { normalizeMoonPayWebhook } = await importMoonPay('');

    const funded = normalizeMoonPayWebhook({
      type: 'transaction_completed',
      data: {
        id: 'mp_tx_123',
        status: 'completed',
        externalTransactionId: 'fi_123',
        externalCustomerId: 'coal:buyer:123',
        walletAddress: '0x2222222222222222222222222222222222222222',
        email: 'ada@example.com',
        redirectUrl: 'https://buy.moonpay.com/tracker/tx_123',
      },
    });

    const failed = normalizeMoonPayWebhook({
      type: 'transaction_failed',
      data: {
        id: 'mp_tx_456',
        status: 'failed',
        externalTransactionId: 'fi_456',
        failureReason: 'payment_declined',
      },
    });

    expect(funded.fundingStatus).toBe('funded');
    expect(funded.providerTransactionId).toBe('mp_tx_123');
    expect(funded.externalTransactionId).toBe('fi_123');
    expect(funded.customerEmail).toBe('ada@example.com');
    expect(funded.trackerUrl).toBe('https://buy.moonpay.com/tracker/tx_123');

    expect(failed.fundingStatus).toBe('failed');
    expect(failed.failureReason).toBe('payment_declined');
    expect(failed.externalTransactionId).toBe('fi_456');
  });
});
