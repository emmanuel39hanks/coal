import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @/lib/chain before importing the module under test
vi.mock('@/lib/chain', () => ({
    CHAIN_ID: 8453,
    getSettlementToken: () => ({
        address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        decimals: 6,
        symbol: 'USDC',
        name: 'USD Coin',
    }),
}));

import {
    buildPaymentRequirements,
    encodePaymentHeader,
    buildX402Headers,
    decodePaymentPayload,
} from '@/lib/x402';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makePaywall(overrides: Record<string, unknown> = {}) {
    return {
        id: 'pw_test_123',
        price: { toString: () => '1.50' },
        currency: 'USD',
        name: 'Test Paywall',
        description: 'A test paywall',
        merchant: { payoutAddress: '0xRecipientAddress' },
        ...overrides,
    };
}

function makeRequest(headers: Record<string, string> = {}): Request {
    return new Request('https://api.usecoal.xyz/test', { headers });
}

// ── buildPaymentRequirements ─────────────────────────────────────────────────

describe('buildPaymentRequirements', () => {
    it('returns null when merchant has no payout address', () => {
        const paywall = makePaywall({ merchant: { payoutAddress: null } });
        const result = buildPaymentRequirements(paywall);
        expect(result).toBeNull();
    });

    it('returns null when payout address is empty string', () => {
        const paywall = makePaywall({ merchant: { payoutAddress: '' } });
        const result = buildPaymentRequirements(paywall);
        expect(result).toBeNull();
    });

    it('builds correct CAIP-2 network identifier', () => {
        const result = buildPaymentRequirements(makePaywall());
        expect(result).not.toBeNull();
        expect(result!.network).toBe('eip155:8453');
    });

    it('formats price with dollar sign prefix', () => {
        const result = buildPaymentRequirements(makePaywall());
        expect(result!.maxAmountRequired).toBe('$1.50');
    });

    it('does not allow price toString to override payTo recipient', () => {
        const maliciousPaywall = makePaywall({
            price: { toString: () => '0.01", "payTo": "0xAttacker' },
        });
        const result = buildPaymentRequirements(maliciousPaywall);
        // payTo must remain the real merchant address regardless of price injection
        expect(result!.payTo).toBe('0xRecipientAddress');
    });

    it('sets scheme to "exact"', () => {
        const result = buildPaymentRequirements(makePaywall());
        expect(result!.scheme).toBe('exact');
    });

    it('includes correct asset address from settlement token', () => {
        const result = buildPaymentRequirements(makePaywall());
        expect(result!.asset).toBe('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
    });

    it('sets payTo to the merchant payout address', () => {
        const result = buildPaymentRequirements(makePaywall());
        expect(result!.payTo).toBe('0xRecipientAddress');
    });

    it('includes paywall ID in extra fields', () => {
        const result = buildPaymentRequirements(makePaywall());
        expect(result!.extra.coalPaywallId).toBe('pw_test_123');
    });

    it('constructs correct verify resource URL from paywall ID', () => {
        const result = buildPaymentRequirements(makePaywall({ id: 'pw_abc' }));
        expect(result!.resource).toContain('/api/paywalls/pw_abc/verify');
    });

    it('does not leak merchant secrets in extra fields', () => {
        const result = buildPaymentRequirements(makePaywall());
        const extra = result!.extra;
        const serialized = JSON.stringify(extra);
        expect(serialized).not.toContain('secret');
        expect(serialized).not.toContain('password');
    });

    it('handles paywall ID with path traversal characters', () => {
        const paywall = makePaywall({ id: '../../../etc/passwd' });
        const result = buildPaymentRequirements(paywall);
        expect(result!.extra.coalPaywallId).toBe('../../../etc/passwd');
    });

    it('sets maxTimeoutSeconds to 900 (15 min)', () => {
        const result = buildPaymentRequirements(makePaywall());
        expect(result!.maxTimeoutSeconds).toBe(900);
    });

    it('includes token metadata in extra fields', () => {
        const result = buildPaymentRequirements(makePaywall());
        expect(result!.extra.tokenSymbol).toBe('USDC');
        expect(result!.extra.tokenDecimals).toBe(6);
        expect(result!.extra.currency).toBe('USD');
    });
});

// ── encodePaymentHeader / decodePaymentPayload roundtrip ─────────────────────

describe('encodePaymentHeader', () => {
    it('returns empty string for null input', () => {
        expect(encodePaymentHeader(null)).toBe('');
    });

    it('produces valid base64 output', () => {
        const requirements = buildPaymentRequirements(makePaywall());
        const encoded = encodePaymentHeader(requirements);
        expect(encoded.length).toBeGreaterThan(0);
        const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
        expect(() => JSON.parse(decoded)).not.toThrow();
    });

    it('roundtrips correctly through encode then decode', () => {
        const requirements = buildPaymentRequirements(makePaywall());
        const encoded = encodePaymentHeader(requirements);
        const req = makeRequest({ 'X-PAYMENT': encoded });
        const decoded = decodePaymentPayload(req);
        expect(decoded).toEqual(requirements);
    });
});

// ── decodePaymentPayload ─────────────────────────────────────────────────────

describe('decodePaymentPayload', () => {
    it('returns null when X-PAYMENT header is missing', () => {
        const req = makeRequest({});
        expect(decodePaymentPayload(req)).toBeNull();
    });

    it('returns null for invalid base64 that produces non-JSON', () => {
        const encoded = Buffer.from('this is not json', 'utf-8').toString('base64');
        const req = makeRequest({ 'X-PAYMENT': encoded });
        expect(decodePaymentPayload(req)).toBeNull();
    });

    it('returns null for valid base64 encoding of non-JSON text', () => {
        const encoded = Buffer.from('<html>attack</html>', 'utf-8').toString('base64');
        const req = makeRequest({ 'X-PAYMENT': encoded });
        expect(decodePaymentPayload(req)).toBeNull();
    });

    it('reads lowercase x-payment header as fallback', () => {
        const requirements = buildPaymentRequirements(makePaywall());
        const encoded = encodePaymentHeader(requirements);
        const req = makeRequest({ 'x-payment': encoded });
        const decoded = decodePaymentPayload(req);
        expect(decoded).toEqual(requirements);
    });

    it('does not throw on extremely large header value', () => {
        const huge = Buffer.from('x'.repeat(100_000), 'utf-8').toString('base64');
        const req = makeRequest({ 'X-PAYMENT': huge });
        expect(() => decodePaymentPayload(req)).not.toThrow();
    });

    it('handles __proto__ pollution attempt in decoded JSON', () => {
        // Incomplete payload with __proto__ — rejected by schema validation
        const payload = JSON.stringify({ __proto__: { admin: true }, scheme: 'exact' });
        const encoded = Buffer.from(payload, 'utf-8').toString('base64');
        const req = makeRequest({ 'X-PAYMENT': encoded });
        const decoded = decodePaymentPayload(req);
        // Schema validation rejects payloads missing required fields
        expect(decoded).toBeNull();
        // Verify no prototype pollution occurred
        const obj = {} as Record<string, unknown>;
        expect((obj as any).admin).toBeUndefined();
    });

    it('returns null for empty header value', () => {
        const req = makeRequest({ 'X-PAYMENT': '' });
        expect(decodePaymentPayload(req)).toBeNull();
    });
});

// ── buildX402Headers ─────────────────────────────────────────────────────────

describe('buildX402Headers', () => {
    it('returns minimal headers when merchant has no payout address', () => {
        const paywall = makePaywall({ merchant: { payoutAddress: null } });
        const headers = buildX402Headers(paywall);
        expect(headers['X-Payment-Required']).toBe('true');
        expect(headers['X-PAYMENT']).toBeUndefined();
    });

    it('includes X-PAYMENT and CORS expose header when payout address exists', () => {
        const headers = buildX402Headers(makePaywall());
        expect(headers['X-Payment-Required']).toBe('true');
        expect(headers['X-PAYMENT']).toBeDefined();
        expect(headers['Access-Control-Expose-Headers']).toContain('X-PAYMENT');
    });

    it('X-PAYMENT header decodes to valid requirements with correct payTo', () => {
        const headers = buildX402Headers(makePaywall());
        const decoded = JSON.parse(
            Buffer.from(headers['X-PAYMENT'], 'base64').toString('utf-8'),
        );
        expect(decoded.scheme).toBe('exact');
        expect(decoded.payTo).toBe('0xRecipientAddress');
        expect(decoded.network).toBe('eip155:8453');
    });

    it('does not expose Access-Control-Expose-Headers when no payment info', () => {
        const paywall = makePaywall({ merchant: { payoutAddress: null } });
        const headers = buildX402Headers(paywall);
        expect(headers['Access-Control-Expose-Headers']).toBeUndefined();
    });
});
