/**
 * Unit tests for coal-react/next (Next.js route helpers).
 *
 * Covers:
 *   - createAgentCardRoute: A2A Agent Card JSON with merchant data
 *   - createLlmsTxtRoute: plain-text llms.txt with products + paywalls
 *   - createX402ManifestRoute: x402 Bazaar-style manifest
 *   - Cache-Control headers
 *   - Not-found handling
 *   - Override options (name, description, url, title, etc.)
 *   - Custom apiUrl + fetch injection
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    createAgentCardRoute,
    createLlmsTxtRoute,
    createX402ManifestRoute,
} from '../next';

function mockProfileFetch(profile: Record<string, unknown> | null) {
    return vi.fn().mockResolvedValue({
        ok: profile !== null,
        status: profile === null ? 404 : 200,
        json: async () => ({
            merchantId: (profile?.merchantId as string) ?? 'lst_test',
            profile: profile ?? {},
            zeroG: profile?.zeroG ?? undefined,
        }),
    });
}

const MOCK_PROFILE = {
    version: 'coal.merchant_profile.v1',
    merchantId: 'lst_test',
    name: 'Saint Digital Store',
    email: 'saint@test.com',
    payoutAddress: '0xpayout',
    productCount: 2,
    paywallCount: 1,
    topProducts: [
        {
            id: 'prod_1',
            name: 'Chocolate Cake',
            price: '0.05',
            image: 'https://cdn.test/cake.png',
            description: 'A rich chocolate cake.',
        },
        {
            id: 'prod_2',
            name: 'F1 Figurine',
            price: '0.1',
            image: null,
            description: null,
        },
    ],
    topPaywalls: [
        {
            id: 'pw_1',
            name: 'API Access',
            price: '1.5',
            currency: 'USDC',
            pricingModel: 'per_call',
            contentType: 'api',
            description: 'Paid API access.',
        },
    ],
    supportedNetworks: [{ id: 8453, name: 'base' }],
    supportedTokens: [
        {
            address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
            symbol: 'USDC',
            name: 'USD Coin',
            decimals: 6,
        },
    ],
    capabilities: {
        paywalls: true,
        receiptVerification: true,
        aiCommerce: true,
        merchantMemory: true,
    },
    endpoints: {
        merchantProfile: 'https://api.usecoal.xyz/api/agent/merchant-profiles/lst_test',
        memoryQuery: 'https://api.usecoal.xyz/api/agent/memory/query',
        commerceRoute: 'https://api.usecoal.xyz/api/agent/commerce/route',
    },
    urls: {
        profile: 'https://saintstore.example/',
        docs: 'https://docs.saintstore.example/',
    },
    updatedAt: '2026-04-11T10:00:00.000Z',
    zeroG: {
        published: true,
        storageUri: '0g://log/0xroot',
        storageRoot: '0xroot',
        payloadHash: '0xhash',
    },
};

// ─── createAgentCardRoute ────────────────────────────────────────────────────

describe('createAgentCardRoute', () => {
    let fetchImpl: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        fetchImpl = mockProfileFetch(MOCK_PROFILE);
    });

    it('returns a 200 JSON response', async () => {
        const GET = createAgentCardRoute({
            merchantId: 'lst_test',
            fetch: fetchImpl,
        });
        const res = await GET();
        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toContain('application/json');
    });

    it('emits the correct A2A Agent Card shape', async () => {
        const GET = createAgentCardRoute({
            merchantId: 'lst_test',
            fetch: fetchImpl,
        });
        const res = await GET();
        const body = await res.json();

        expect(body.name).toBe('Saint Digital Store');
        expect(body.description).toContain('Saint Digital Store');
        expect(body.description).toContain('2 products');
        expect(body.description).toContain('1 paywall');
        expect(body.description).toContain('USDC');
        expect(body.version).toBe('1.0.0');

        // Capabilities
        expect(body.capabilities).toContain('commerce.checkout');
        expect(body.capabilities).toContain('commerce.catalog');
        expect(body.capabilities).toContain('commerce.paywall.x402');
        expect(body.capabilities).toContain('commerce.memory.query');
        expect(body.capabilities).toContain('commerce.ai.route');

        // Authentication
        expect(body.authentication.schemes).toContain('x-api-key');
        expect(body.authentication.schemes).toContain('x402');

        // Payment
        expect(body.payment.networks).toEqual([{ id: 8453, name: 'base' }]);
        expect(body.payment.tokens[0].symbol).toBe('USDC');
        expect(body.payment.protocols).toContain('x402');

        // Catalog
        expect(body.catalog.productCount).toBe(2);
        expect(body.catalog.paywallCount).toBe(1);
        expect(body.catalog.products).toHaveLength(2);
        expect(body.catalog.paywalls).toHaveLength(1);

        // 0G proof
        expect(body.proof.network).toBe('0g');
        expect(body.proof.storageRoot).toBe('0xroot');

        // Extension
        expect(body['x-coal'].merchantId).toBe('lst_test');
        expect(body['x-coal'].generator).toContain('coal-react/next');
    });

    it('does not include paywall/memory capabilities when absent', async () => {
        const slim = {
            ...MOCK_PROFILE,
            paywallCount: 0,
            topPaywalls: [],
            capabilities: { merchantMemory: false, aiCommerce: false },
        };
        const GET = createAgentCardRoute({
            merchantId: 'lst_test',
            fetch: mockProfileFetch(slim),
        });
        const body = await (await GET()).json();

        expect(body.capabilities).toContain('commerce.checkout');
        expect(body.capabilities).not.toContain('commerce.paywall.x402');
        expect(body.capabilities).not.toContain('commerce.memory.query');
        expect(body.capabilities).not.toContain('commerce.ai.route');
    });

    it('respects name, description, and url overrides', async () => {
        const GET = createAgentCardRoute({
            merchantId: 'lst_test',
            name: 'Custom Name',
            description: 'Custom description.',
            url: 'https://custom.example/',
            fetch: fetchImpl,
        });
        const body = await (await GET()).json();

        expect(body.name).toBe('Custom Name');
        expect(body.description).toBe('Custom description.');
        expect(body.url).toBe('https://custom.example/');
    });

    it('returns 404 when the merchant profile fetch fails', async () => {
        const GET = createAgentCardRoute({
            merchantId: 'lst_missing',
            fetch: mockProfileFetch(null),
        });
        const res = await GET();
        expect(res.status).toBe(404);
    });

    it('emits Cache-Control headers with the configured max age', async () => {
        const GET = createAgentCardRoute({
            merchantId: 'lst_test',
            cacheMaxAge: 60,
            fetch: fetchImpl,
        });
        const res = await GET();
        const cacheControl = res.headers.get('cache-control')!;
        expect(cacheControl).toContain('max-age=60');
        expect(cacheControl).toContain('s-maxage=60');
        expect(cacheControl).toContain('stale-while-revalidate=120');
    });

    it('calls the expected merchant profile endpoint', async () => {
        const GET = createAgentCardRoute({
            merchantId: 'lst_test',
            apiUrl: 'https://staging.coal.test',
            fetch: fetchImpl,
        });
        await GET();
        expect(fetchImpl).toHaveBeenCalledWith(
            'https://staging.coal.test/api/agent/merchant-profiles/lst_test',
            expect.any(Object),
        );
    });

    it('does not include 0G proof block when merchant has no published artifact', async () => {
        const noProof = { ...MOCK_PROFILE, zeroG: undefined };
        const GET = createAgentCardRoute({
            merchantId: 'lst_test',
            fetch: mockProfileFetch(noProof),
        });
        const body = await (await GET()).json();
        expect(body.proof).toBeNull();
    });
});

// ─── createLlmsTxtRoute ──────────────────────────────────────────────────────

describe('createLlmsTxtRoute', () => {
    it('returns a 200 text/plain response', async () => {
        const GET = createLlmsTxtRoute({
            merchantId: 'lst_test',
            fetch: mockProfileFetch(MOCK_PROFILE),
        });
        const res = await GET();
        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toContain('text/plain');
    });

    it('includes a heading, summary, products, paywalls, and payment rails', async () => {
        const GET = createLlmsTxtRoute({
            merchantId: 'lst_test',
            fetch: mockProfileFetch(MOCK_PROFILE),
        });
        const res = await GET();
        const text = await res.text();

        expect(text).toContain('# Saint Digital Store');
        expect(text).toContain('## Products');
        expect(text).toContain('Chocolate Cake');
        expect(text).toContain('$0.05 USDC');
        expect(text).toContain('F1 Figurine');
        expect(text).toContain('## Paywalls');
        expect(text).toContain('API Access');
        expect(text).toContain('$1.5 USDC/call');
        expect(text).toContain('## Payment rails');
        expect(text).toContain('USDC on base');
        expect(text).toContain('x402');
        expect(text).toContain('0G');
        expect(text).toContain('## For AI agents');
        expect(text).toContain('/api/agent/merchant-profiles/lst_test');
    });

    it('handles merchants with no products', async () => {
        const noProducts = { ...MOCK_PROFILE, topProducts: [], productCount: 0 };
        const GET = createLlmsTxtRoute({
            merchantId: 'lst_test',
            fetch: mockProfileFetch(noProducts),
        });
        const text = await (await GET()).text();
        expect(text).toContain('(no products listed)');
    });

    it('omits the Paywalls section when there are no paywalls', async () => {
        const noPaywalls = { ...MOCK_PROFILE, topPaywalls: [], paywallCount: 0 };
        const GET = createLlmsTxtRoute({
            merchantId: 'lst_test',
            fetch: mockProfileFetch(noPaywalls),
        });
        const text = await (await GET()).text();
        expect(text).not.toContain('## Paywalls');
    });

    it('respects title, summary, and extra overrides', async () => {
        const GET = createLlmsTxtRoute({
            merchantId: 'lst_test',
            title: 'Overridden Title',
            summary: 'Overridden summary.',
            extra: '## Custom\nAppended content.',
            fetch: mockProfileFetch(MOCK_PROFILE),
        });
        const text = await (await GET()).text();

        expect(text).toContain('# Overridden Title');
        expect(text).toContain('> Overridden summary.');
        expect(text).toContain('## Custom');
        expect(text).toContain('Appended content.');
    });

    it('returns 404 when the merchant profile is missing', async () => {
        const GET = createLlmsTxtRoute({
            merchantId: 'lst_missing',
            fetch: mockProfileFetch(null),
        });
        const res = await GET();
        expect(res.status).toBe(404);
    });

    it('truncates long product descriptions', async () => {
        const longDesc = 'x'.repeat(500);
        const longProfile = {
            ...MOCK_PROFILE,
            topProducts: [
                {
                    id: 'p1',
                    name: 'Thing',
                    price: '9.99',
                    image: null,
                    description: longDesc,
                },
            ],
        };
        const GET = createLlmsTxtRoute({
            merchantId: 'lst_test',
            fetch: mockProfileFetch(longProfile),
        });
        const text = await (await GET()).text();
        // Truncation appends an ellipsis and drops bytes from the original
        // description. The 500-char run of 'x's should never appear in full.
        expect(text).toContain('…');
        expect(text).not.toContain(longDesc);
        // The truncated segment keeps at most 140 chars of 'x'.
        const xRun = text.match(/x+/)?.[0] ?? '';
        expect(xRun.length).toBeLessThanOrEqual(140);
    });
});

// ─── createX402ManifestRoute ─────────────────────────────────────────────────

describe('createX402ManifestRoute', () => {
    it('returns a 200 JSON manifest', async () => {
        const GET = createX402ManifestRoute({
            merchantId: 'lst_test',
            fetch: mockProfileFetch(MOCK_PROFILE),
        });
        const res = await GET();
        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toContain('application/json');
    });

    it('emits the x402 manifest shape', async () => {
        const GET = createX402ManifestRoute({
            merchantId: 'lst_test',
            fetch: mockProfileFetch(MOCK_PROFILE),
        });
        const body = await (await GET()).json();

        expect(body.version).toBe('x402-manifest/v1');
        expect(body.name).toBe('Saint Digital Store');
        expect(body.merchantId).toBe('lst_test');
        expect(body.network).toBe('base');
        expect(body.asset).toBe('USDC');
        expect(body.assetAddress).toBe(
            '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        );

        expect(body.endpoints).toHaveLength(1);
        expect(body.endpoints[0].id).toBe('pw_1');
        expect(body.endpoints[0].verifyUrl).toBe(
            'https://api.usecoal.xyz/api/paywalls/pw_1/verify',
        );
        expect(body.endpoints[0].protocol).toBe('x402');

        expect(body.facilitator.name).toBe('Coal');
        expect(body.proof.network).toBe('0g');
    });

    it('respects a custom apiUrl when constructing verify URLs', async () => {
        const GET = createX402ManifestRoute({
            merchantId: 'lst_test',
            apiUrl: 'https://staging.coal.test/',
            fetch: mockProfileFetch(MOCK_PROFILE),
        });
        const body = await (await GET()).json();
        expect(body.endpoints[0].verifyUrl).toBe(
            'https://staging.coal.test/api/paywalls/pw_1/verify',
        );
    });

    it('returns an empty endpoints array when the merchant has no paywalls', async () => {
        const noPaywalls = { ...MOCK_PROFILE, topPaywalls: [], paywallCount: 0 };
        const GET = createX402ManifestRoute({
            merchantId: 'lst_test',
            fetch: mockProfileFetch(noPaywalls),
        });
        const body = await (await GET()).json();
        expect(body.endpoints).toEqual([]);
    });

    it('returns 404 when the merchant is missing', async () => {
        const GET = createX402ManifestRoute({
            merchantId: 'lst_missing',
            fetch: mockProfileFetch(null),
        });
        const res = await GET();
        expect(res.status).toBe(404);
    });
});
