/**
 * Unit tests for coal-react/server (publishCoalCatalog).
 *
 * These tests cover:
 *   - Input validation (merchantId, apiKey, products array)
 *   - URL construction (trailing slash handling, custom apiUrl)
 *   - Request shape (headers, method, body)
 *   - Successful response parsing
 *   - HTTP error responses (400/401/429/500)
 *   - Network errors
 *   - Abort signal handling
 *   - Custom fetch implementation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { publishCoalCatalog, CoalPublishError } from '../server';

function mockFetch(response: {
    ok: boolean;
    status?: number;
    body?: unknown;
    bodyText?: string;
}): ReturnType<typeof vi.fn> {
    return vi.fn().mockResolvedValue({
        ok: response.ok,
        status: response.status ?? (response.ok ? 200 : 500),
        json: async () => {
            if (response.body !== undefined) return response.body;
            if (response.bodyText !== undefined) {
                try {
                    return JSON.parse(response.bodyText);
                } catch {
                    throw new Error('Not JSON');
                }
            }
            return {};
        },
    });
}

const VALID_OPTS = {
    merchantId: 'lst_test',
    apiKey: 'coal_live_test_key',
    products: [
        { externalId: 'sku-1', name: 'Pro Plan', price: 29.99 },
        { externalId: 'sku-2', name: 'Enterprise', price: 99 },
    ],
};

describe('publishCoalCatalog — input validation', () => {
    it('throws CoalPublishError when merchantId is missing', async () => {
        await expect(
            publishCoalCatalog({ ...VALID_OPTS, merchantId: '' }),
        ).rejects.toBeInstanceOf(CoalPublishError);
    });

    it('throws CoalPublishError when apiKey is missing', async () => {
        await expect(
            publishCoalCatalog({ ...VALID_OPTS, apiKey: '' }),
        ).rejects.toBeInstanceOf(CoalPublishError);
    });

    it('throws CoalPublishError when products is empty', async () => {
        await expect(
            publishCoalCatalog({ ...VALID_OPTS, products: [] }),
        ).rejects.toBeInstanceOf(CoalPublishError);
    });

    it('throws CoalPublishError when products is not an array', async () => {
        await expect(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            publishCoalCatalog({ ...VALID_OPTS, products: 'oops' as any }),
        ).rejects.toBeInstanceOf(CoalPublishError);
    });

    it('throws CoalPublishError when products exceeds 500 items', async () => {
        const products = Array.from({ length: 501 }, (_, i) => ({
            externalId: `sku-${i}`,
            name: 'Product',
            price: 1,
        }));
        await expect(
            publishCoalCatalog({ ...VALID_OPTS, products }),
        ).rejects.toBeInstanceOf(CoalPublishError);
    });
});

describe('publishCoalCatalog — URL construction', () => {
    it('uses the default Coal API URL when apiUrl is omitted', async () => {
        const fetchImpl = mockFetch({
            ok: true,
            body: {
                merchantId: 'lst_test',
                productCount: 2,
                deactivated: 0,
                mode: 'upsert',
                products: [],
                zeroG: {
                    published: false,
                    skipped: false,
                    storageUri: null,
                    storageRoot: null,
                    storageTxHash: null,
                    payloadHash: null,
                    kv: null,
                },
            },
        });

        await publishCoalCatalog({ ...VALID_OPTS, fetch: fetchImpl });

        expect(fetchImpl).toHaveBeenCalledWith(
            'https://api.usecoal.xyz/api/agent/publish-catalog',
            expect.any(Object),
        );
    });

    it('respects a custom apiUrl without trailing slashes', async () => {
        const fetchImpl = mockFetch({
            ok: true,
            body: {
                merchantId: 'lst_test',
                productCount: 2,
                deactivated: 0,
                mode: 'upsert',
                products: [],
                zeroG: {
                    published: false,
                    skipped: false,
                    storageUri: null,
                    storageRoot: null,
                    storageTxHash: null,
                    payloadHash: null,
                    kv: null,
                },
            },
        });

        await publishCoalCatalog({
            ...VALID_OPTS,
            apiUrl: 'https://staging.usecoal.xyz/',
            fetch: fetchImpl,
        });

        expect(fetchImpl).toHaveBeenCalledWith(
            'https://staging.usecoal.xyz/api/agent/publish-catalog',
            expect.any(Object),
        );
    });

    it('strips multiple trailing slashes from apiUrl', async () => {
        const fetchImpl = mockFetch({
            ok: true,
            body: {
                merchantId: 'lst_test',
                productCount: 2,
                deactivated: 0,
                mode: 'upsert',
                products: [],
                zeroG: {
                    published: false,
                    skipped: false,
                    storageUri: null,
                    storageRoot: null,
                    storageTxHash: null,
                    payloadHash: null,
                    kv: null,
                },
            },
        });

        await publishCoalCatalog({
            ...VALID_OPTS,
            apiUrl: 'http://localhost:3001///',
            fetch: fetchImpl,
        });

        expect(fetchImpl).toHaveBeenCalledWith(
            'http://localhost:3001/api/agent/publish-catalog',
            expect.any(Object),
        );
    });
});

describe('publishCoalCatalog — request shape', () => {
    let fetchImpl: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        fetchImpl = mockFetch({
            ok: true,
            body: {
                merchantId: 'lst_test',
                productCount: 2,
                deactivated: 0,
                mode: 'upsert',
                products: [],
                zeroG: {
                    published: true,
                    skipped: false,
                    storageUri: '0g://log/0xroot',
                    storageRoot: '0xroot',
                    storageTxHash: '0xtx',
                    payloadHash: '0xhash',
                    kv: { streamId: '0xstream', key: 'merchant:profile:latest' },
                },
            },
        });
    });

    it('sends POST with correct headers', async () => {
        await publishCoalCatalog({ ...VALID_OPTS, fetch: fetchImpl });

        const [, init] = fetchImpl.mock.calls[0];
        expect(init.method).toBe('POST');
        expect(init.headers['content-type']).toBe('application/json');
        expect(init.headers['x-api-key']).toBe('coal_live_test_key');
        expect(init.headers['x-coal-sdk']).toContain('coal-react');
    });

    it('sends the products and mode in the body', async () => {
        await publishCoalCatalog({
            ...VALID_OPTS,
            mode: 'replace',
            fetch: fetchImpl,
        });

        const [, init] = fetchImpl.mock.calls[0];
        const body = JSON.parse(init.body);
        expect(body.mode).toBe('replace');
        expect(body.products).toHaveLength(2);
        expect(body.products[0].externalId).toBe('sku-1');
        expect(body.products[0].name).toBe('Pro Plan');
    });

    it('defaults mode to "upsert" when not provided', async () => {
        await publishCoalCatalog({ ...VALID_OPTS, fetch: fetchImpl });

        const [, init] = fetchImpl.mock.calls[0];
        const body = JSON.parse(init.body);
        expect(body.mode).toBe('upsert');
    });

    it('normalizes string prices to numbers', async () => {
        await publishCoalCatalog({
            ...VALID_OPTS,
            products: [{ externalId: 'sku-1', name: 'P1', price: '29.99' }],
            fetch: fetchImpl,
        });

        const [, init] = fetchImpl.mock.calls[0];
        const body = JSON.parse(init.body);
        expect(body.products[0].price).toBe(29.99);
        expect(typeof body.products[0].price).toBe('number');
    });

    it('forwards the abort signal', async () => {
        const controller = new AbortController();
        await publishCoalCatalog({
            ...VALID_OPTS,
            fetch: fetchImpl,
            signal: controller.signal,
        });

        const [, init] = fetchImpl.mock.calls[0];
        expect(init.signal).toBe(controller.signal);
    });
});

describe('publishCoalCatalog — response handling', () => {
    it('returns the parsed body on success', async () => {
        const fetchImpl = mockFetch({
            ok: true,
            body: {
                merchantId: 'lst_test',
                productCount: 1,
                deactivated: 0,
                mode: 'upsert',
                products: [{ id: 'p1', externalId: 'sku-1', name: 'P1', price: '9.99', image: null, active: true }],
                zeroG: {
                    published: true,
                    skipped: false,
                    storageUri: '0g://log/0xroot',
                    storageRoot: '0xroot',
                    storageTxHash: '0xtx',
                    payloadHash: '0xhash',
                    kv: { streamId: '0xstream', key: 'merchant:profile:latest' },
                },
            },
        });

        const result = await publishCoalCatalog({ ...VALID_OPTS, fetch: fetchImpl });

        expect(result.merchantId).toBe('lst_test');
        expect(result.productCount).toBe(1);
        expect(result.zeroG.published).toBe(true);
        expect(result.zeroG.storageRoot).toBe('0xroot');
        expect(result.zeroG.kv?.key).toBe('merchant:profile:latest');
    });

    it('throws CoalPublishError with status + code on 400', async () => {
        const fetchImpl = mockFetch({
            ok: false,
            status: 400,
            body: {
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Validation failed',
                    details: { products: ['externalId is required'] },
                },
            },
        });

        await expect(
            publishCoalCatalog({ ...VALID_OPTS, fetch: fetchImpl }),
        ).rejects.toMatchObject({
            name: 'CoalPublishError',
            status: 400,
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
        });
    });

    it('throws CoalPublishError with status 401 on unauthorized', async () => {
        const fetchImpl = mockFetch({
            ok: false,
            status: 401,
            body: { error: { code: 'UNAUTHORIZED', message: 'Invalid API key' } },
        });

        await expect(
            publishCoalCatalog({ ...VALID_OPTS, fetch: fetchImpl }),
        ).rejects.toMatchObject({ status: 401, code: 'UNAUTHORIZED' });
    });

    it('throws CoalPublishError with status 429 on rate limit', async () => {
        const fetchImpl = mockFetch({
            ok: false,
            status: 429,
            body: { error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
        });

        await expect(
            publishCoalCatalog({ ...VALID_OPTS, fetch: fetchImpl }),
        ).rejects.toMatchObject({ status: 429, code: 'RATE_LIMITED' });
    });

    it('throws CoalPublishError when the response is not JSON', async () => {
        const fetchImpl = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => {
                throw new Error('Unexpected token');
            },
        });

        await expect(
            publishCoalCatalog({ ...VALID_OPTS, fetch: fetchImpl }),
        ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    });

    it('throws CoalPublishError with NETWORK_ERROR on fetch failure', async () => {
        const fetchImpl = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

        await expect(
            publishCoalCatalog({ ...VALID_OPTS, fetch: fetchImpl }),
        ).rejects.toMatchObject({
            code: 'NETWORK_ERROR',
            status: 0,
        });
    });

    it('throws CoalPublishError with ABORTED code when the request is aborted', async () => {
        const abortErr = new Error('Aborted');
        abortErr.name = 'AbortError';
        const fetchImpl = vi.fn().mockRejectedValue(abortErr);

        await expect(
            publishCoalCatalog({ ...VALID_OPTS, fetch: fetchImpl }),
        ).rejects.toMatchObject({ code: 'ABORTED', status: 0 });
    });

    it('handles non-standard error bodies gracefully', async () => {
        const fetchImpl = mockFetch({
            ok: false,
            status: 500,
            body: { something: 'unexpected' },
        });

        await expect(
            publishCoalCatalog({ ...VALID_OPTS, fetch: fetchImpl }),
        ).rejects.toMatchObject({
            status: 500,
            // No error.code in body → code defaults to null
            code: null,
        });
    });
});
