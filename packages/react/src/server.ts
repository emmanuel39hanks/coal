/**
 * coal-react/server
 *
 * Server-only helpers for Coal. Everything in this module is designed to run
 * on the server (Node, Next.js route handlers, edge functions, Cloudflare
 * Workers) — never in the browser — because these helpers take a full Coal
 * API key that should never be shipped to a client bundle.
 *
 * Import with:
 *   import { publishCoalCatalog } from 'coal-react/server';
 */

// ---------------------------------------------------------------------------
// Server-only guard
// ---------------------------------------------------------------------------
// Runs at module load time. If a bundler (Next.js, Webpack, Vite, etc.)
// accidentally pulls this file into a client chunk, the browser will throw
// the moment the chunk loads — BEFORE any API key can leak. This is a
// belt-and-suspenders check on top of the `exports` sub-path convention
// that `coal-react/server` is a server-only surface.
if (typeof window !== 'undefined') {
    throw new Error(
        '[coal-react/server] This module is server-only. Importing it in a ' +
            'client component will leak your COAL_API_KEY to the browser bundle. ' +
            'Call publishCoalCatalog() from a Next.js server action, API route ' +
            'handler, or any other Node/edge-runtime context instead.',
    );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A single product in an external merchant catalog. The `externalId` is the
 * merchant's own stable identifier — it is used as the idempotency key on
 * Coal's side so the same sync call can be replayed safely.
 */
export interface CoalCatalogProduct {
    /** Merchant-owned stable product ID. Required. Max 128 chars. */
    externalId: string;
    /** Product display name. Required. Max 200 chars. */
    name: string;
    /** Optional short description. Max 2000 chars. */
    description?: string;
    /** Price in the settlement token (USDC on Base by default). */
    price: number | string;
    /** Primary product image URL. */
    image?: string;
    /** Additional image URLs. Max 6. */
    images?: string[];
    /** Optional SKU. */
    sku?: string;
    /** Optional tags for discovery filtering. Max 10, max 50 chars each. */
    tags?: string[];
    /** one_time (default) or subscription. */
    billingType?: 'one_time' | 'subscription';
    /** Required when billingType = subscription. */
    billingInterval?: 'day' | 'week' | 'month' | 'year';
    /** Optional multiplier for billingInterval. Defaults to 1. */
    billingIntervalCount?: number;
}

export interface PublishCoalCatalogOptions {
    /** Coal merchant ID that owns the catalog. */
    merchantId: string;
    /** Coal API key. Must stay server-side. */
    apiKey: string;
    /**
     * Products to publish. Each is upserted keyed by (merchantId, externalId).
     * 1..500 items per call.
     */
    products: CoalCatalogProduct[];
    /**
     * Publish mode.
     * - `upsert` (default): only touches products listed in the payload.
     * - `replace`: additionally deactivates any existing external products
     *   whose externalId is NOT in the payload. Console-sourced products are
     *   never affected.
     */
    mode?: 'upsert' | 'replace';
    /**
     * Coal API base URL. Defaults to 'https://api.usecoal.xyz'. Override for
     * local dev or staging environments.
     */
    apiUrl?: string;
    /**
     * Optional abort signal to cancel an in-flight publish.
     */
    signal?: AbortSignal;
    /**
     * Optional custom fetch implementation. Defaults to global fetch.
     * Useful for test environments or Cloudflare Workers.
     */
    fetch?: typeof fetch;
}

export interface PublishedProduct {
    id: string;
    externalId: string;
    name: string;
    price: string;
    image: string | null;
    active: boolean;
}

export interface PublishCoalCatalogResult {
    merchantId: string;
    productCount: number;
    deactivated: number;
    mode: 'upsert' | 'replace';
    products: PublishedProduct[];
    zeroG: {
        published: boolean;
        skipped: boolean;
        storageUri: string | null;
        storageRoot: string | null;
        storageTxHash: string | null;
        payloadHash: string | null;
        kv: {
            streamId: string;
            key: string;
        } | null;
    };
}

export class CoalPublishError extends Error {
    public readonly status: number;
    public readonly code: string | null;
    public readonly details: unknown;

    constructor(
        status: number,
        code: string | null,
        message: string,
        details?: unknown,
    ) {
        super(message);
        this.name = 'CoalPublishError';
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

// ---------------------------------------------------------------------------
// publishCoalCatalog
// ---------------------------------------------------------------------------

const DEFAULT_API_URL = 'https://api.usecoal.xyz';

/**
 * Publish an external catalog to Coal.
 *
 * Calls POST /api/agent/publish-catalog on the Coal backend. On success, Coal
 * upserts the products into its database and re-publishes the merchant profile
 * to 0G Storage (Log layer + KV mirror) so AI agents hitting
 * /api/agent/discover or /api/agent/merchant-profiles get fresh data.
 *
 * This function MUST be called from a server context. The Coal API key passed
 * in should be kept out of client bundles.
 *
 * @example
 *   import { publishCoalCatalog } from 'coal-react/server';
 *
 *   await publishCoalCatalog({
 *     merchantId: 'lst00PqE...',
 *     apiKey: process.env.COAL_API_KEY!,
 *     products: [
 *       { externalId: 'sku-1', name: 'Pro Plan', price: 29.99 },
 *       { externalId: 'sku-2', name: 'Enterprise', price: 99 },
 *     ],
 *   });
 */
export async function publishCoalCatalog(
    options: PublishCoalCatalogOptions,
): Promise<PublishCoalCatalogResult> {
    const {
        merchantId,
        apiKey,
        products,
        mode = 'upsert',
        apiUrl = DEFAULT_API_URL,
        signal,
        fetch: fetchImpl,
    } = options;

    if (!merchantId) {
        throw new CoalPublishError(0, 'INVALID_ARGUMENT', 'merchantId is required');
    }
    if (!apiKey) {
        throw new CoalPublishError(0, 'INVALID_ARGUMENT', 'apiKey is required');
    }
    if (!Array.isArray(products) || products.length === 0) {
        throw new CoalPublishError(0, 'INVALID_ARGUMENT', 'products must be a non-empty array');
    }
    if (products.length > 500) {
        throw new CoalPublishError(
            0,
            'INVALID_ARGUMENT',
            'Maximum 500 products per publish — split into batches',
        );
    }

    const base = apiUrl.replace(/\/+$/, '');
    const url = `${base}/api/agent/publish-catalog`;

    // Validate + normalize product prices. Coal's server-side Zod catches
    // garbage values with a 400, but validating here gives merchants a clear
    // error BEFORE the network round-trip and before rate limit counts tick.
    const normalized = products.map((p, i) => {
        if (!p.externalId) {
            throw new CoalPublishError(
                0,
                'INVALID_ARGUMENT',
                `products[${i}].externalId is required`,
            );
        }
        if (!p.name) {
            throw new CoalPublishError(
                0,
                'INVALID_ARGUMENT',
                `products[${i}].name is required`,
            );
        }

        const priceNum = typeof p.price === 'string' ? Number(p.price) : p.price;
        if (typeof priceNum !== 'number' || !Number.isFinite(priceNum)) {
            throw new CoalPublishError(
                0,
                'INVALID_ARGUMENT',
                `products[${i}].price must be a finite number (got ${String(p.price)})`,
            );
        }
        if (priceNum <= 0) {
            throw new CoalPublishError(
                0,
                'INVALID_ARGUMENT',
                `products[${i}].price must be positive (got ${priceNum})`,
            );
        }
        if (priceNum > 1_000_000) {
            throw new CoalPublishError(
                0,
                'INVALID_ARGUMENT',
                `products[${i}].price must not exceed 1,000,000 (got ${priceNum})`,
            );
        }
        // Max 6 decimals — mirrors Coal's amountField schema and USDC precision.
        const decimals = priceNum.toString().split('.')[1]?.length ?? 0;
        if (decimals > 6) {
            throw new CoalPublishError(
                0,
                'INVALID_ARGUMENT',
                `products[${i}].price may have at most 6 decimal places`,
            );
        }

        return { ...p, price: priceNum };
    });

    const doFetch = fetchImpl ?? fetch;

    let response: Response;
    try {
        response = await doFetch(url, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-api-key': apiKey,
                'x-coal-sdk': `coal-react@server`,
            },
            body: JSON.stringify({ products: normalized, mode }),
            signal,
        });
    } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
            throw new CoalPublishError(0, 'ABORTED', 'Catalog publish was aborted');
        }
        const msg = err instanceof Error ? err.message : 'Unknown network error';
        throw new CoalPublishError(0, 'NETWORK_ERROR', `Failed to reach Coal API: ${msg}`);
    }

    let body: unknown;
    try {
        body = await response.json();
    } catch {
        throw new CoalPublishError(
            response.status,
            'INVALID_RESPONSE',
            `Coal API returned non-JSON response (status ${response.status})`,
        );
    }

    if (!response.ok) {
        const errBody = (body && typeof body === 'object' && 'error' in body
            ? (body as { error: unknown }).error
            : null) as
            | { code?: string; message?: string; details?: unknown }
            | null;
        throw new CoalPublishError(
            response.status,
            errBody?.code ?? null,
            errBody?.message ?? `Coal API error (status ${response.status})`,
            errBody?.details,
        );
    }

    return body as PublishCoalCatalogResult;
}

// ---------------------------------------------------------------------------
// Re-export types for convenience
// ---------------------------------------------------------------------------

export type { PublishCoalCatalogOptions as CoalPublishCatalogOptions };
