/**
 * E2E test: POST /api/agent/publish-catalog
 *
 * Exercises the catalog indexing endpoint that merchants use to push their
 * external catalog (Shopify/Sanity/Postgres/wherever) into Coal for agent
 * discovery. Covers:
 *   - Happy path (upsert + 0G publish)
 *   - Auth failure (missing/invalid API key)
 *   - Validation failure (bad body shape, duplicate externalIds)
 *   - Rate limit (1/min per merchant)
 *   - Idempotency (republish same payload → dedup skip)
 *   - Upsert mode (leaves other products alone)
 *   - Replace mode (deactivates external products missing from payload)
 *   - External product isolation from console products
 *   - 0G publish failure falls back to local DB success
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockValidateApiKey = vi.fn();
const mockProductUpsert = vi.fn();
const mockProductUpdateMany = vi.fn();
const mockTransaction = vi.fn();

vi.mock('@/lib/api-auth', () => ({
    validateApiKey: (...args: unknown[]) => mockValidateApiKey(...args),
}));

vi.mock('@/lib/prisma', () => ({
    prisma: {
        product: {
            upsert: (...args: unknown[]) => mockProductUpsert(...args),
            updateMany: (...args: unknown[]) => mockProductUpdateMany(...args),
        },
        $transaction: (...args: unknown[]) => mockTransaction(...args),
    },
}));

vi.mock('@/lib/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    zeroGLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Rate limit: configurable, default "not limited"
const mockCheckRateLimit = vi.fn();
vi.mock('@/lib/rate-limit', () => ({
    rateLimiters: {
        publish: { requests: 1, windowMs: 60_000, upstash: null },
    },
    checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
    getIP: vi.fn().mockReturnValue('127.0.0.1'),
}));

const mockPublishMerchantProfileBundle = vi.fn();
vi.mock('@/lib/0g/merchant', () => ({
    publishMerchantProfileBundle: (...args: unknown[]) =>
        mockPublishMerchantProfileBundle(...args),
}));

vi.mock('@/lib/0g/catalog', () => ({
    buildZeroGStreamId: vi.fn(
        (namespace: string, id: string) => `0xstream_${namespace}_${id}`,
    ),
}));

vi.mock('@/lib/chain', () => ({
    CHAIN_ID: 8453,
    getSettlementToken: () => ({
        address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
    }),
}));

// ─── Fixtures ────────────────────────────────────────────────────────────────

const MERCHANT_ID = 'merchant_test_external';

const API_KEY_RECORD = {
    id: 'key_test_pub',
    secretHash: 'hashed',
    revokedAt: null,
    merchant: {
        id: MERCHANT_ID,
        name: 'External Catalog Merchant',
        email: 'ext@test.com',
        payoutAddress: '0xmerchant_ext',
    },
};

const BASE_PRODUCT = {
    externalId: 'ext-sku-1',
    name: 'API Pro Plan',
    description: 'Monthly API access',
    price: 29.99,
    image: 'https://example.com/img.png',
    tags: ['api', 'subscription'],
};

function makeRequest(
    body: unknown,
    opts: { apiKey?: string | null } = {},
): Request {
    const headers: Record<string, string> = {
        'content-type': 'application/json',
    };
    if (opts.apiKey !== null) {
        headers['x-api-key'] = opts.apiKey ?? 'coal_live_testkey';
    }
    return new Request('https://api.test/api/agent/publish-catalog', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    });
}

function upsertedRow(externalId: string, overrides: Record<string, unknown> = {}) {
    return {
        id: `prod_${externalId}`,
        merchantId: MERCHANT_ID,
        externalId,
        source: 'external',
        name: 'API Pro Plan',
        description: 'Monthly API access',
        price: { toString: () => '29.99' },
        image: 'https://example.com/img.png',
        tags: ['api', 'subscription'],
        active: true,
        status: 'active',
        ...overrides,
    };
}

// ─── Test Suites ─────────────────────────────────────────────────────────────

let POST: typeof import('@/app/api/agent/publish-catalog/route').POST;

beforeAll(async () => {
    ({ POST } = await import('@/app/api/agent/publish-catalog/route'));
});

describe('POST /api/agent/publish-catalog', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCheckRateLimit.mockResolvedValue({ limited: false, headers: {} });
        // Default transaction: forward to the callback with the mocked prisma fns.
        mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
            return fn({
                product: {
                    upsert: mockProductUpsert,
                    updateMany: mockProductUpdateMany,
                },
            });
        });
    });

    // ─── Auth ────────────────────────────────────────────────────────────────

    describe('Authentication', () => {
        it('rejects requests without an API key', async () => {
            mockValidateApiKey.mockResolvedValue(null);
            const res = await POST(
                makeRequest({ products: [BASE_PRODUCT] }, { apiKey: null }),
            );
            expect(res.status).toBe(401);
        });

        it('rejects requests with an invalid API key', async () => {
            mockValidateApiKey.mockResolvedValue(null);
            const res = await POST(
                makeRequest({ products: [BASE_PRODUCT] }, { apiKey: 'coal_live_bad' }),
            );
            expect(res.status).toBe(401);
        });

        it('accepts requests with a valid API key and resolves the merchant', async () => {
            mockValidateApiKey.mockResolvedValue(API_KEY_RECORD);
            mockProductUpsert.mockResolvedValue(upsertedRow('ext-sku-1'));
            mockPublishMerchantProfileBundle.mockResolvedValue({
                profile: { merchantId: MERCHANT_ID },
                artifact: {
                    storageUri: '0g://log/0xroot',
                    storageRoot: '0xroot',
                    storageTxHash: '0xtx',
                    payloadHash: '0xhash',
                },
                skipped: false,
            });

            const res = await POST(
                makeRequest({ products: [BASE_PRODUCT] }),
            );
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.merchantId).toBe(MERCHANT_ID);
        });
    });

    // ─── Rate limit ──────────────────────────────────────────────────────────

    describe('Rate limiting', () => {
        it('returns 429 when the rate limit is hit', async () => {
            mockValidateApiKey.mockResolvedValue(API_KEY_RECORD);
            mockCheckRateLimit.mockResolvedValue({
                limited: true,
                headers: { 'X-RateLimit-Remaining': '0' },
            });

            const res = await POST(makeRequest({ products: [BASE_PRODUCT] }));
            expect(res.status).toBe(429);
            expect(mockTransaction).not.toHaveBeenCalled();
        });

        it('rate-limit key is scoped per merchant', async () => {
            mockValidateApiKey.mockResolvedValue(API_KEY_RECORD);
            mockProductUpsert.mockResolvedValue(upsertedRow('ext-sku-1'));
            mockPublishMerchantProfileBundle.mockResolvedValue(null);

            await POST(makeRequest({ products: [BASE_PRODUCT] }));

            expect(mockCheckRateLimit).toHaveBeenCalledWith(
                expect.objectContaining({ requests: 1 }),
                `publish:${MERCHANT_ID}`,
            );
        });
    });

    // ─── Validation ──────────────────────────────────────────────────────────

    describe('Validation', () => {
        beforeEach(() => {
            mockValidateApiKey.mockResolvedValue(API_KEY_RECORD);
        });

        it('rejects empty products array', async () => {
            const res = await POST(makeRequest({ products: [] }));
            expect(res.status).toBe(400);
        });

        it('rejects missing externalId', async () => {
            const { externalId: _, ...rest } = BASE_PRODUCT;
            void _;
            const res = await POST(makeRequest({ products: [rest] }));
            expect(res.status).toBe(400);
        });

        it('rejects missing name', async () => {
            const { name: _, ...rest } = BASE_PRODUCT;
            void _;
            const res = await POST(makeRequest({ products: [rest] }));
            expect(res.status).toBe(400);
        });

        it('rejects negative price', async () => {
            const res = await POST(
                makeRequest({ products: [{ ...BASE_PRODUCT, price: -5 }] }),
            );
            expect(res.status).toBe(400);
        });

        it('rejects duplicate externalId values in the same payload', async () => {
            const res = await POST(
                makeRequest({
                    products: [
                        BASE_PRODUCT,
                        { ...BASE_PRODUCT, name: 'Duplicate entry' },
                    ],
                }),
            );
            expect(res.status).toBe(400);
            const body = await res.json();
            expect(JSON.stringify(body)).toContain('Duplicate externalId');
        });

        it('rejects more than 500 products', async () => {
            const products = Array.from({ length: 501 }, (_, i) => ({
                ...BASE_PRODUCT,
                externalId: `sku-${i}`,
            }));
            const res = await POST(makeRequest({ products }));
            expect(res.status).toBe(400);
        });

        it('rejects invalid mode values', async () => {
            const res = await POST(
                makeRequest({ products: [BASE_PRODUCT], mode: 'nuke' }),
            );
            expect(res.status).toBe(400);
        });
    });

    // ─── Happy path ──────────────────────────────────────────────────────────

    describe('Happy path', () => {
        beforeEach(() => {
            mockValidateApiKey.mockResolvedValue(API_KEY_RECORD);
        });

        it('upserts products and publishes to 0G', async () => {
            mockProductUpsert
                .mockResolvedValueOnce(upsertedRow('ext-sku-1'))
                .mockResolvedValueOnce(upsertedRow('ext-sku-2'));
            mockPublishMerchantProfileBundle.mockResolvedValue({
                profile: { merchantId: MERCHANT_ID },
                artifact: {
                    storageUri: '0g://log/0xroot',
                    storageRoot: '0xroot',
                    storageTxHash: '0xtx',
                    payloadHash: '0xhash',
                },
                skipped: false,
            });

            const res = await POST(
                makeRequest({
                    products: [
                        BASE_PRODUCT,
                        { ...BASE_PRODUCT, externalId: 'ext-sku-2' },
                    ],
                }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.merchantId).toBe(MERCHANT_ID);
            expect(body.productCount).toBe(2);
            expect(body.mode).toBe('upsert');
            expect(body.deactivated).toBe(0);
            expect(body.zeroG.published).toBe(true);
            expect(body.zeroG.skipped).toBe(false);
            expect(body.zeroG.storageUri).toBe('0g://log/0xroot');
            expect(body.zeroG.storageRoot).toBe('0xroot');
            expect(body.zeroG.kv).toBeTruthy();
            expect(body.zeroG.kv.key).toBe('merchant:profile:latest');
            expect(body.zeroG.kv.streamId).toContain('0xstream_merchant');
            expect(body.products).toHaveLength(2);

            // Prisma upsert called with (merchantId, externalId) composite key
            expect(mockProductUpsert).toHaveBeenCalledTimes(2);
            expect(mockProductUpsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {
                        merchantId_externalId: {
                            merchantId: MERCHANT_ID,
                            externalId: 'ext-sku-1',
                        },
                    },
                    create: expect.objectContaining({
                        source: 'external',
                        externalId: 'ext-sku-1',
                        merchantId: MERCHANT_ID,
                    }),
                }),
            );

            // Merchant profile publish was called exactly once
            expect(mockPublishMerchantProfileBundle).toHaveBeenCalledWith(MERCHANT_ID);
            expect(mockPublishMerchantProfileBundle).toHaveBeenCalledTimes(1);

            // Replace mode NOT used → updateMany not called
            expect(mockProductUpdateMany).not.toHaveBeenCalled();
        });

        it('returns skipped flag when 0G dedup hits (unchanged payload)', async () => {
            mockProductUpsert.mockResolvedValue(upsertedRow('ext-sku-1'));
            mockPublishMerchantProfileBundle.mockResolvedValue({
                profile: { merchantId: MERCHANT_ID },
                artifact: {
                    storageUri: '0g://log/0xexisting',
                    storageRoot: '0xexisting',
                    storageTxHash: null,
                    payloadHash: '0xhash',
                },
                skipped: true,
            });

            const res = await POST(makeRequest({ products: [BASE_PRODUCT] }));
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.zeroG.skipped).toBe(true);
            expect(body.zeroG.published).toBe(false);
            expect(body.zeroG.storageUri).toBe('0g://log/0xexisting');
        });

        it('falls back gracefully when 0G publish fails', async () => {
            mockProductUpsert.mockResolvedValue(upsertedRow('ext-sku-1'));
            mockPublishMerchantProfileBundle.mockRejectedValue(
                new Error('0G storage unavailable'),
            );

            const res = await POST(makeRequest({ products: [BASE_PRODUCT] }));
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.productCount).toBe(1);
            expect(body.zeroG.published).toBe(false);
            expect(body.zeroG.storageUri).toBeNull();
        });

        it('returns null zeroG details when 0G is disabled', async () => {
            mockProductUpsert.mockResolvedValue(upsertedRow('ext-sku-1'));
            // publishMerchantProfileBundle() returns null when ZERO_G_ENABLED=false
            mockPublishMerchantProfileBundle.mockResolvedValue(null);

            const res = await POST(makeRequest({ products: [BASE_PRODUCT] }));
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.productCount).toBe(1);
            expect(body.zeroG.published).toBe(false);
            expect(body.zeroG.kv).toBeNull();
        });
    });

    // ─── Replace mode ────────────────────────────────────────────────────────

    describe('Replace mode', () => {
        beforeEach(() => {
            mockValidateApiKey.mockResolvedValue(API_KEY_RECORD);
            mockPublishMerchantProfileBundle.mockResolvedValue(null);
        });

        it('deactivates external products missing from the payload', async () => {
            mockProductUpsert.mockResolvedValue(upsertedRow('ext-sku-1'));
            mockProductUpdateMany.mockResolvedValue({ count: 3 });

            const res = await POST(
                makeRequest({ products: [BASE_PRODUCT], mode: 'replace' }),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.mode).toBe('replace');
            expect(body.deactivated).toBe(3);

            expect(mockProductUpdateMany).toHaveBeenCalledWith({
                where: {
                    merchantId: MERCHANT_ID,
                    source: 'external',
                    externalId: { notIn: ['ext-sku-1'] },
                    active: true,
                },
                data: { active: false, status: 'archived' },
            });
        });

        it('does not touch console-sourced products in replace mode', async () => {
            mockProductUpsert.mockResolvedValue(upsertedRow('ext-sku-1'));
            mockProductUpdateMany.mockResolvedValue({ count: 0 });

            await POST(
                makeRequest({ products: [BASE_PRODUCT], mode: 'replace' }),
            );

            // Key assertion: the updateMany where clause is scoped to source='external'
            // so console products are immune from replace-mode archival.
            const call = mockProductUpdateMany.mock.calls[0][0];
            expect(call.where.source).toBe('external');
        });

        it('upsert mode (default) does not call updateMany', async () => {
            mockProductUpsert.mockResolvedValue(upsertedRow('ext-sku-1'));

            const res = await POST(
                makeRequest({ products: [BASE_PRODUCT] }), // no mode → defaults to upsert
            );
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.mode).toBe('upsert');
            expect(mockProductUpdateMany).not.toHaveBeenCalled();
        });
    });

    // ─── Transaction atomicity ───────────────────────────────────────────────

    describe('Transaction atomicity', () => {
        beforeEach(() => {
            mockValidateApiKey.mockResolvedValue(API_KEY_RECORD);
            mockPublishMerchantProfileBundle.mockResolvedValue(null);
        });

        it('wraps all upserts in a single prisma transaction', async () => {
            mockProductUpsert
                .mockResolvedValueOnce(upsertedRow('ext-sku-1'))
                .mockResolvedValueOnce(upsertedRow('ext-sku-2'))
                .mockResolvedValueOnce(upsertedRow('ext-sku-3'));

            await POST(
                makeRequest({
                    products: [
                        BASE_PRODUCT,
                        { ...BASE_PRODUCT, externalId: 'ext-sku-2' },
                        { ...BASE_PRODUCT, externalId: 'ext-sku-3' },
                    ],
                }),
            );

            // All upserts inside one transaction call
            expect(mockTransaction).toHaveBeenCalledTimes(1);
            expect(mockProductUpsert).toHaveBeenCalledTimes(3);
        });

        it('propagates a 500 when the transaction throws', async () => {
            mockTransaction.mockRejectedValue(new Error('DB connection lost'));

            const res = await POST(makeRequest({ products: [BASE_PRODUCT] }));
            expect(res.status).toBe(500);
            expect(mockPublishMerchantProfileBundle).not.toHaveBeenCalled();
        });
    });
});
