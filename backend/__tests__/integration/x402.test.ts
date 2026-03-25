import { describe, it, expect, vi, beforeAll } from 'vitest';

vi.mock('@/lib/chain', () => ({
  CHAIN_ID: 8453,
  getSettlementToken: () => ({
    address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
  }),
}));

let buildPaymentRequirements: typeof import('@/lib/x402').buildPaymentRequirements;
let encodePaymentHeader: typeof import('@/lib/x402').encodePaymentHeader;
let decodePaymentPayload: typeof import('@/lib/x402').decodePaymentPayload;
let buildX402Headers: typeof import('@/lib/x402').buildX402Headers;

beforeAll(async () => {
  ({ buildPaymentRequirements, encodePaymentHeader, decodePaymentPayload, buildX402Headers } =
    await import('@/lib/x402'));
});

// ─── buildPaymentRequirements ─────────────────────────────────────────────────

describe('buildPaymentRequirements', () => {
  const basePaywall = {
    id: 'pw_test_123',
    price: { toString: () => '49.99' },
    currency: 'USDC',
    name: 'Premium API Access',
    description: 'Full access to the API',
    merchant: { payoutAddress: '0x1234567890123456789012345678901234567890' },
  };

  it('returns the correct x402 structure for a standard paywall', () => {
    const result = buildPaymentRequirements(basePaywall);

    expect(result).not.toBeNull();
    expect(result!.scheme).toBe('exact');
    expect(result!.network).toBe('eip155:8453');
    expect(result!.maxAmountRequired).toBe('$49.99');
    expect(result!.payTo).toBe('0x1234567890123456789012345678901234567890');
    expect(result!.maxTimeoutSeconds).toBe(900);
    expect(result!.asset).toBe('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
    expect(result!.mimeType).toBe('application/json');
    expect(result!.description).toBe('Premium API Access');
  });

  it('includes Coal-specific extra fields with correct URLs', () => {
    const result = buildPaymentRequirements(basePaywall);

    expect(result!.extra).toBeDefined();
    expect(result!.extra.coalPaywallId).toBe('pw_test_123');
    expect(result!.extra.coalPayUrl).toContain('/api/paywalls/pw_test_123/pay');
    expect(result!.extra.coalPayIntentUrl).toContain('/api/agent/paywalls/pw_test_123/pay-intent');
    expect(result!.extra.coalManifestUrl).toContain('/api/agent/paywalls/pw_test_123/manifest');
    expect(result!.extra.coalReceiptVerifyTemplate).toContain('/api/agent/receipts/{checkoutId}/verify');
    expect(result!.extra.currency).toBe('USDC');
    expect(result!.extra.tokenSymbol).toBe('USDC');
    expect(result!.extra.tokenDecimals).toBe(6);
  });

  it('constructs the resource URL referencing the paywall verify endpoint', () => {
    const result = buildPaymentRequirements(basePaywall);

    expect(result!.resource).toContain('/api/paywalls/pw_test_123/verify');
  });

  it('returns null when merchant has no payout address', () => {
    const paywall = {
      ...basePaywall,
      merchant: { payoutAddress: null },
    };

    const result = buildPaymentRequirements(paywall);
    expect(result).toBeNull();
  });

  it('handles zero price paywall', () => {
    const paywall = {
      ...basePaywall,
      price: { toString: () => '0' },
    };

    const result = buildPaymentRequirements(paywall);
    expect(result).not.toBeNull();
    expect(result!.maxAmountRequired).toBe('$0');
  });

  it('handles fractional prices with many decimal places', () => {
    const paywall = {
      ...basePaywall,
      price: { toString: () => '0.001234' },
    };

    const result = buildPaymentRequirements(paywall);
    expect(result!.maxAmountRequired).toBe('$0.001234');
  });

  it('handles large prices correctly', () => {
    const paywall = {
      ...basePaywall,
      price: { toString: () => '999999.99' },
    };

    const result = buildPaymentRequirements(paywall);
    expect(result!.maxAmountRequired).toBe('$999999.99');
  });

  it('handles special characters in paywall name', () => {
    const paywall = {
      ...basePaywall,
      name: 'AI & ML "Insights" <Premium>',
    };

    const result = buildPaymentRequirements(paywall);
    expect(result!.description).toBe('AI & ML "Insights" <Premium>');
  });

  it('handles null description without error', () => {
    const paywall = {
      ...basePaywall,
      description: null,
    };

    const result = buildPaymentRequirements(paywall);
    expect(result).not.toBeNull();
  });
});

// ─── encodePaymentHeader / decodePaymentPayload roundtrip ─────────────────────

describe('encodePaymentHeader and decodePaymentPayload roundtrip', () => {
  const paywall = {
    id: 'pw_roundtrip',
    price: { toString: () => '9.99' },
    currency: 'USDC',
    name: 'Roundtrip Test',
    description: 'Testing encoding roundtrip',
    merchant: { payoutAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
  };

  it('encodes requirements to a non-empty base64 string', () => {
    const requirements = buildPaymentRequirements(paywall);
    const encoded = encodePaymentHeader(requirements);

    expect(encoded).toBeTruthy();
    expect(typeof encoded).toBe('string');
    // Base64 should not contain raw JSON chars like unescaped braces
    expect(encoded).not.toContain('{');
  });

  it('roundtrips: encoding then decoding preserves all fields', () => {
    const requirements = buildPaymentRequirements(paywall);
    const encoded = encodePaymentHeader(requirements);

    const request = new Request('http://localhost/test', {
      headers: { 'X-PAYMENT': encoded },
    });

    const decoded = decodePaymentPayload(request);

    expect(decoded).not.toBeNull();
    expect(decoded!.scheme).toBe('exact');
    expect(decoded!.network).toBe('eip155:8453');
    expect(decoded!.maxAmountRequired).toBe('$9.99');
    expect(decoded!.payTo).toBe('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    expect(decoded!.description).toBe('Roundtrip Test');
    expect(decoded!.asset).toBe('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
  });

  it('decodes via lowercase x-payment header too', () => {
    const requirements = buildPaymentRequirements(paywall);
    const encoded = encodePaymentHeader(requirements);

    const request = new Request('http://localhost/test', {
      headers: { 'x-payment': encoded },
    });

    const decoded = decodePaymentPayload(request);
    expect(decoded).not.toBeNull();
    expect(decoded!.payTo).toBe('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  });

  it('returns empty string when encoding null requirements', () => {
    const encoded = encodePaymentHeader(null);
    expect(encoded).toBe('');
  });

  it('returns null for missing X-PAYMENT header', () => {
    const request = new Request('http://localhost/test');
    const decoded = decodePaymentPayload(request);
    expect(decoded).toBeNull();
  });

  it('returns null for valid base64 but non-JSON content', () => {
    const encoded = Buffer.from('this is not json', 'utf-8').toString('base64');
    const request = new Request('http://localhost/test', {
      headers: { 'X-PAYMENT': encoded },
    });

    const decoded = decodePaymentPayload(request);
    expect(decoded).toBeNull();
  });

  it('returns null for empty X-PAYMENT header', () => {
    const request = new Request('http://localhost/test', {
      headers: { 'X-PAYMENT': '' },
    });

    const decoded = decodePaymentPayload(request);
    expect(decoded).toBeNull();
  });
});

// ─── buildX402Headers ────────────────────────────────────────────────────────

describe('buildX402Headers', () => {
  it('returns full header set when merchant has payout address', () => {
    const paywall = {
      id: 'pw_headers',
      price: { toString: () => '19.99' },
      currency: 'USDC',
      name: 'Header Test',
      description: null,
      merchant: { payoutAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
    };

    const headers = buildX402Headers(paywall);

    expect(headers['X-Payment-Required']).toBe('true');
    expect(headers['X-PAYMENT']).toBeTruthy();
    expect(headers['Access-Control-Expose-Headers']).toContain('X-PAYMENT');
    expect(headers['Access-Control-Expose-Headers']).toContain('X-Payment-Required');
  });

  it('returns only X-Payment-Required when merchant has no payout address', () => {
    const paywall = {
      id: 'pw_no_payout',
      price: { toString: () => '19.99' },
      currency: 'USDC',
      name: 'No Payout',
      description: null,
      merchant: { payoutAddress: null },
    };

    const headers = buildX402Headers(paywall);

    expect(headers['X-Payment-Required']).toBe('true');
    expect(headers['X-PAYMENT']).toBeUndefined();
    expect(headers['Access-Control-Expose-Headers']).toBeUndefined();
  });

  it('X-PAYMENT header is valid base64 that decodes to payment requirements', () => {
    const paywall = {
      id: 'pw_decode',
      price: { toString: () => '5.00' },
      currency: 'USDC',
      name: 'Decode Test',
      description: 'Test',
      merchant: { payoutAddress: '0xcccccccccccccccccccccccccccccccccccccccc' },
    };

    const headers = buildX402Headers(paywall);
    const decoded = JSON.parse(Buffer.from(headers['X-PAYMENT'], 'base64').toString('utf-8'));

    expect(decoded.scheme).toBe('exact');
    expect(decoded.payTo).toBe('0xcccccccccccccccccccccccccccccccccccccccc');
    expect(decoded.maxAmountRequired).toBe('$5.00');
  });

  it('always includes exactly three headers when payout address exists', () => {
    const paywall = {
      id: 'pw_count',
      price: { toString: () => '1.00' },
      currency: 'USDC',
      name: 'Count',
      description: null,
      merchant: { payoutAddress: '0xdddddddddddddddddddddddddddddddddddddd' },
    };

    const headers = buildX402Headers(paywall);
    expect(Object.keys(headers)).toHaveLength(3);
  });

  it('always includes exactly one header when payout address is missing', () => {
    const paywall = {
      id: 'pw_one',
      price: { toString: () => '1.00' },
      currency: 'USDC',
      name: 'One',
      description: null,
      merchant: { payoutAddress: null },
    };

    const headers = buildX402Headers(paywall);
    expect(Object.keys(headers)).toHaveLength(1);
  });
});
