/**
 * coal-react/next
 *
 * Next.js App Router route handlers that expose a merchant's catalog on the
 * agent-discoverable web. Drop one file per manifest into your merchant's
 * own Next.js app and the site becomes findable by AI agents via the
 * standard protocols: A2A Agent Card, llms.txt, and x402.
 *
 *   // app/.well-known/agent-card.json/route.ts
 *   import { createAgentCardRoute } from 'coal-react/next';
 *   export const GET = createAgentCardRoute({ merchantId: 'lst00PqE...' });
 *
 *   // app/llms.txt/route.ts
 *   import { createLlmsTxtRoute } from 'coal-react/next';
 *   export const GET = createLlmsTxtRoute({ merchantId: 'lst00PqE...' });
 *
 *   // app/.well-known/x402.json/route.ts
 *   import { createX402ManifestRoute } from 'coal-react/next';
 *   export const GET = createX402ManifestRoute({ merchantId: 'lst00PqE...' });
 *
 * Each route fetches the merchant profile from Coal's public agent API, so
 * whatever has been indexed on 0G Storage / KV flows through to the manifest
 * automatically. No API key required — these routes are read-only and serve
 * public merchant data.
 */

// ---------------------------------------------------------------------------
// Shared types + fetching
// ---------------------------------------------------------------------------

const DEFAULT_API_URL = 'https://api.usecoal.xyz';
const DEFAULT_CACHE_MAX_AGE = 300; // 5 minutes — profile data changes ~once per merchant update

interface MerchantProfile {
    version: string;
    merchantId: string;
    name?: string | null;
    email?: string | null;
    payoutAddress?: string | null;
    productCount?: number;
    paywallCount?: number;
    topProducts?: Array<{
        id: string;
        name: string;
        price: string;
        image?: string | null;
        description?: string | null;
    }>;
    topPaywalls?: Array<{
        id: string;
        name: string;
        price: string;
        currency: string;
        pricingModel?: string;
        contentType?: string;
        description?: string | null;
    }>;
    supportedNetworks?: Array<{ id: number; name: string }>;
    supportedTokens?: Array<{
        address: string;
        symbol: string;
        name: string;
        decimals: number;
    }>;
    capabilities?: Record<string, boolean>;
    endpoints?: Record<string, string>;
    urls?: Record<string, string>;
    updatedAt?: string;
}

interface MerchantProfileResponse {
    merchantId: string;
    profile: MerchantProfile;
    zeroG?: {
        published: boolean;
        storageUri?: string | null;
        storageRoot?: string | null;
        payloadHash?: string | null;
    };
}

interface BaseRouteOptions {
    /** Coal merchant ID. */
    merchantId: string;
    /** Coal API base URL. Defaults to 'https://api.usecoal.xyz'. */
    apiUrl?: string;
    /** Cache-Control max-age in seconds. Defaults to 300 (5 minutes). */
    cacheMaxAge?: number;
    /** Optional custom fetch implementation. */
    fetch?: typeof fetch;
}

async function fetchMerchantProfile(
    merchantId: string,
    apiUrl: string,
    fetchImpl?: typeof fetch,
): Promise<MerchantProfileResponse | null> {
    const base = apiUrl.replace(/\/+$/, '');
    const url = `${base}/api/agent/merchant-profiles/${encodeURIComponent(merchantId)}`;
    const doFetch = fetchImpl ?? fetch;

    try {
        const response = await doFetch(url, {
            method: 'GET',
            headers: {
                accept: 'application/json',
                'x-coal-sdk': 'coal-react@next',
            },
            // Hint Next.js's data cache — it revalidates against Coal's API periodically
            // @ts-expect-error next-specific fetch option
            next: { revalidate: 300 },
        });
        if (!response.ok) return null;
        return (await response.json()) as MerchantProfileResponse;
    } catch {
        return null;
    }
}

function jsonResponse(data: unknown, cacheMaxAge: number): Response {
    return new Response(JSON.stringify(data, null, 2), {
        status: 200,
        headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': `public, max-age=${cacheMaxAge}, s-maxage=${cacheMaxAge}, stale-while-revalidate=${cacheMaxAge * 2}`,
        },
    });
}

function textResponse(data: string, cacheMaxAge: number): Response {
    return new Response(data, {
        status: 200,
        headers: {
            'content-type': 'text/plain; charset=utf-8',
            'cache-control': `public, max-age=${cacheMaxAge}, s-maxage=${cacheMaxAge}, stale-while-revalidate=${cacheMaxAge * 2}`,
        },
    });
}

function notFound(message: string): Response {
    return new Response(JSON.stringify({ error: message }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
    });
}

// ---------------------------------------------------------------------------
// createAgentCardRoute — A2A Agent Card (Google + Linux Foundation)
// ---------------------------------------------------------------------------

export interface AgentCardRouteOptions extends BaseRouteOptions {
    /** Override the agent name. Defaults to the merchant's name from Coal. */
    name?: string;
    /** Override the agent description. Defaults to an auto-generated summary. */
    description?: string;
    /** Override the agent URL. Defaults to the merchant's website. */
    url?: string;
}

/**
 * Returns a Next.js App Router GET handler that serves an A2A Agent Card
 * JSON document at /.well-known/agent-card.json. The card follows the
 * structure defined by Google's Agent2Agent protocol (RFC 8615 well-known
 * URIs) so any A2A-capable agent can discover and interact with this
 * merchant.
 */
export function createAgentCardRoute(
    options: AgentCardRouteOptions,
): () => Promise<Response> {
    const {
        merchantId,
        apiUrl = DEFAULT_API_URL,
        cacheMaxAge = DEFAULT_CACHE_MAX_AGE,
        name: nameOverride,
        description: descriptionOverride,
        url: urlOverride,
        fetch: fetchImpl,
    } = options;

    return async function GET(): Promise<Response> {
        const data = await fetchMerchantProfile(merchantId, apiUrl, fetchImpl);
        if (!data) return notFound(`Merchant ${merchantId} not found`);

        const { profile } = data;
        const displayName = nameOverride || profile.name || 'Coal Merchant';
        const productCount = profile.productCount ?? profile.topProducts?.length ?? 0;
        const paywallCount = profile.paywallCount ?? profile.topPaywalls?.length ?? 0;
        const autoDescription =
            descriptionOverride ||
            `${displayName} — ${productCount} product${productCount === 1 ? '' : 's'}` +
                (paywallCount > 0 ? ` and ${paywallCount} paywall${paywallCount === 1 ? '' : 's'}` : '') +
                `, payable in ${profile.supportedTokens?.[0]?.symbol ?? 'USDC'} via Coal on Base.`;

        const agentCard = {
            // A2A Agent Card spec (Google + Linux Foundation)
            name: displayName,
            description: autoDescription,
            version: '1.0.0',
            url: urlOverride || profile.urls?.profile || undefined,
            // Coal's on-chain settlement endpoint
            endpoints: {
                merchantProfile: profile.endpoints?.merchantProfile,
                commerce: profile.endpoints?.commerceRoute,
                memoryQuery: profile.endpoints?.memoryQuery,
            },
            capabilities: [
                'commerce.checkout',
                'commerce.catalog',
                ...(paywallCount > 0 ? ['commerce.paywall.x402'] : []),
                ...(profile.capabilities?.merchantMemory ? ['commerce.memory.query'] : []),
                ...(profile.capabilities?.aiCommerce ? ['commerce.ai.route'] : []),
            ],
            authentication: {
                schemes: ['x-api-key', 'x402'],
            },
            payment: {
                networks: profile.supportedNetworks ?? [{ id: 8453, name: 'base' }],
                tokens: profile.supportedTokens ?? [],
                protocols: ['x402', 'coal'],
            },
            catalog: {
                productCount,
                paywallCount,
                products: profile.topProducts ?? [],
                paywalls: profile.topPaywalls ?? [],
            },
            proof: data.zeroG
                ? {
                      network: '0g',
                      storageUri: data.zeroG.storageUri,
                      storageRoot: data.zeroG.storageRoot,
                      payloadHash: data.zeroG.payloadHash,
                  }
                : null,
            updatedAt: profile.updatedAt,
            // Coal extension — identifies this card as generated by coal-react
            'x-coal': {
                merchantId: profile.merchantId,
                generator: 'coal-react/next@0.4',
                docs: 'https://usecoal.xyz/docs',
            },
        };

        return jsonResponse(agentCard, cacheMaxAge);
    };
}

// ---------------------------------------------------------------------------
// createLlmsTxtRoute — llms.txt (Answer.AI)
// ---------------------------------------------------------------------------

export interface LlmsTxtRouteOptions extends BaseRouteOptions {
    /** Override the site title. Defaults to merchant name. */
    title?: string;
    /** Override the site summary. */
    summary?: string;
    /** Extra free-text sections appended to the default generated output. */
    extra?: string;
}

/**
 * Returns a Next.js App Router GET handler that serves an `/llms.txt` file
 * following the Answer.AI convention. Most LLMs (ChatGPT, Perplexity, Claude)
 * read `/llms.txt` when citing a site.
 */
export function createLlmsTxtRoute(
    options: LlmsTxtRouteOptions,
): () => Promise<Response> {
    const {
        merchantId,
        apiUrl = DEFAULT_API_URL,
        cacheMaxAge = DEFAULT_CACHE_MAX_AGE,
        title: titleOverride,
        summary: summaryOverride,
        extra,
        fetch: fetchImpl,
    } = options;

    return async function GET(): Promise<Response> {
        const data = await fetchMerchantProfile(merchantId, apiUrl, fetchImpl);
        if (!data) return notFound(`Merchant ${merchantId} not found`);

        const { profile } = data;
        const displayName = titleOverride || profile.name || 'Coal Merchant';
        const productLines =
            profile.topProducts && profile.topProducts.length > 0
                ? profile.topProducts.map(
                      (p) =>
                          `- ${p.name} ($${p.price} ${profile.supportedTokens?.[0]?.symbol ?? 'USDC'})` +
                          (p.description ? ` — ${truncate(p.description, 140)}` : ''),
                  )
                : ['- (no products listed)'];
        const paywallLines =
            profile.topPaywalls && profile.topPaywalls.length > 0
                ? profile.topPaywalls.map(
                      (pw) =>
                          `- ${pw.name} ($${pw.price} ${pw.currency}${pw.pricingModel === 'per_call' ? '/call' : ''})`,
                  )
                : [];
        const summary =
            summaryOverride ||
            `${displayName} is a commerce-enabled site powered by Coal on 0G. AI agents can discover and pay for products and paywalls here autonomously via x402 and USDC on Base.`;

        const sections: string[] = [
            `# ${displayName}`,
            '',
            `> ${summary}`,
            '',
            '## Products',
            ...productLines,
        ];

        if (paywallLines.length > 0) {
            sections.push('', '## Paywalls (agent-payable gates)', ...paywallLines);
        }

        sections.push(
            '',
            '## Payment rails',
            `- Settlement: ${profile.supportedTokens?.[0]?.symbol ?? 'USDC'} on ${profile.supportedNetworks?.[0]?.name ?? 'Base'}`,
            '- Protocol: x402 (HTTP Payment Required)',
            '- Proof: every payment anchored on 0G Chain with a receipt on 0G Storage',
            '- Platform: [Coal](https://usecoal.xyz)',
            '',
            '## For AI agents',
            `- Merchant profile: ${profile.endpoints?.merchantProfile ?? `${apiUrl}/api/agent/merchant-profiles/${merchantId}`}`,
            `- Commerce routing: ${profile.endpoints?.commerceRoute ?? `${apiUrl}/api/agent/commerce/route`}`,
            `- Discovery: ${apiUrl}/api/agent/discover`,
        );

        if (extra) {
            sections.push('', extra.trim());
        }

        return textResponse(sections.join('\n') + '\n', cacheMaxAge);
    };
}

function truncate(s: string, max: number): string {
    if (s.length <= max) return s;
    return s.slice(0, max - 1) + '…';
}

// ---------------------------------------------------------------------------
// createX402ManifestRoute — x402 Bazaar–style paywall manifest
// ---------------------------------------------------------------------------

export interface X402ManifestRouteOptions extends BaseRouteOptions {
    /** Optional human-readable service name. Defaults to merchant name. */
    name?: string;
}

/**
 * Returns a Next.js App Router GET handler that serves an `/.well-known/x402.json`
 * manifest describing all of this merchant's x402 paywall endpoints in a
 * format compatible with x402 Bazaar and any x402-capable agent crawler.
 */
export function createX402ManifestRoute(
    options: X402ManifestRouteOptions,
): () => Promise<Response> {
    const {
        merchantId,
        apiUrl = DEFAULT_API_URL,
        cacheMaxAge = DEFAULT_CACHE_MAX_AGE,
        name: nameOverride,
        fetch: fetchImpl,
    } = options;

    return async function GET(): Promise<Response> {
        const data = await fetchMerchantProfile(merchantId, apiUrl, fetchImpl);
        if (!data) return notFound(`Merchant ${merchantId} not found`);

        const { profile } = data;
        const displayName = nameOverride || profile.name || 'Coal Merchant';
        const base = apiUrl.replace(/\/+$/, '');
        const paywalls = profile.topPaywalls ?? [];

        const manifest = {
            version: 'x402-manifest/v1',
            name: displayName,
            merchantId: profile.merchantId,
            network: profile.supportedNetworks?.[0]?.name ?? 'base',
            asset: profile.supportedTokens?.[0]?.symbol ?? 'USDC',
            assetAddress: profile.supportedTokens?.[0]?.address,
            endpoints: paywalls.map((pw) => ({
                id: pw.id,
                name: pw.name,
                description: pw.description ?? undefined,
                price: pw.price,
                currency: pw.currency,
                pricingModel: pw.pricingModel ?? 'one_time',
                contentType: pw.contentType ?? 'api',
                verifyUrl: `${base}/api/paywalls/${pw.id}/verify`,
                protocol: 'x402',
            })),
            facilitator: {
                name: 'Coal',
                url: 'https://usecoal.xyz',
                docs: 'https://api.usecoal.xyz/api/docs/ui',
            },
            proof: data.zeroG
                ? {
                      network: '0g',
                      storageUri: data.zeroG.storageUri,
                      storageRoot: data.zeroG.storageRoot,
                  }
                : null,
            updatedAt: profile.updatedAt,
        };

        return jsonResponse(manifest, cacheMaxAge);
    };
}
