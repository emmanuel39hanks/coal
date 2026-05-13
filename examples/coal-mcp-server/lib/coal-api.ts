/**
 * Thin HTTP client wrapping Coal's REST API.
 *
 * The MCP server does NOT access Coal's database directly. Every tool call
 * translates into an HTTP request to api.usecoal.xyz (or a custom base URL).
 * This keeps the MCP server stateless and deployable anywhere.
 */

const DEFAULT_API_URL = process.env.COAL_API_URL || 'https://api.usecoal.xyz';

interface FetchOptions {
    method?: string;
    body?: unknown;
    /** API key passed by the calling MCP user via tool args. Never falls back to a shared key. */
    apiKey?: string;
    apiUrl?: string;
}

async function coalFetch<T = unknown>(
    path: string,
    options: FetchOptions = {},
): Promise<T> {
    const {
        method = 'GET',
        body,
        apiKey,
        apiUrl = DEFAULT_API_URL,
    } = options;

    const base = apiUrl.replace(/\/+$/, '');
    const headers: Record<string, string> = {
        accept: 'application/json',
        'x-coal-sdk': 'coal-mcp-server',
    };

    if (apiKey) {
        headers['x-api-key'] = apiKey;
    }
    if (body) {
        headers['content-type'] = 'application/json';
    }

    const res = await fetch(`${base}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Coal API ${method} ${path} returned ${res.status}: ${text.slice(0, 300)}`);
    }

    return res.json() as Promise<T>;
}

// ─── Discovery (public, no auth) ─────────────────────────────────────────────

export async function discoverMerchants() {
    return coalFetch<{
        merchants: Array<{
            id: string;
            name: string;
            productCount: number;
            paywallCount: number;
            topProducts: Array<{ id: string; name: string; price: string; image?: string; description?: string }>;
            topPaywalls: Array<{ id: string; name: string; price: string; currency: string; pricingModel?: string; verifyUrl?: string }>;
            zeroG: { published: boolean; storageRoot?: string; storageUri?: string };
            endpoints: { profile: string; memoryQuery: string };
        }>;
        stats: { totalMerchants: number; totalProducts: number; totalPaywalls: number };
    }>('/api/agent/discover');
}

export async function searchProducts(params: {
    search?: string;
    maxPrice?: number;
    tag?: string;
}) {
    const qs = new URLSearchParams();
    if (params.search) qs.set('search', params.search);
    if (params.maxPrice) qs.set('maxPrice', String(params.maxPrice));
    if (params.tag) qs.set('tag', params.tag);
    const query = qs.toString();
    return coalFetch(`/api/agent/discover/products${query ? `?${query}` : ''}`);
}

export async function getMerchantProfile(merchantId: string) {
    return coalFetch(`/api/agent/merchant-profiles/${encodeURIComponent(merchantId)}`);
}

// ─── Agent Commerce (public, no auth) ────────────────────────────────────────

export async function queryMerchantMemory(params: {
    merchantId: string;
    question: string;
    apiKey: string;
}) {
    const { apiKey, ...body } = params;
    return coalFetch('/api/agent/memory/query', {
        method: 'POST',
        body,
        apiKey,
    });
}

// ─── Paywalls (public read, auth for pay) ────────────────────────────────────

export async function checkPaywall(paywallId: string, address?: string) {
    const qs = address ? `?address=${encodeURIComponent(address)}` : '';
    return coalFetch(`/api/paywalls/${encodeURIComponent(paywallId)}/verify${qs}`);
}

export async function getPaywallManifest(paywallId: string) {
    return coalFetch(`/api/agent/paywalls/${encodeURIComponent(paywallId)}/manifest`);
}

// ─── Checkout (requires API key) ─────────────────────────────────────────────

export async function createCheckout(params: {
    amount: number;
    currency?: string;
    productId?: string;
    productName?: string;
    description?: string;
    metadata?: Record<string, unknown>;
    apiKey: string;
}) {
    const { apiKey, ...body } = params;
    return coalFetch<{
        id: string;
        url: string;
        status: string;
        amount: number | string;
        currency: string;
        expiresAt: string;
    }>('/api/checkouts', {
        method: 'POST',
        body,
        apiKey,
    });
}

export async function getCheckoutStatus(sessionId: string) {
    return coalFetch(`/api/pay/status/${encodeURIComponent(sessionId)}`);
}

export async function confirmPayment(params: {
    sessionId: string;
    txHash: string;
    payerAddress?: string;
}) {
    return coalFetch('/api/pay/confirm', {
        method: 'POST',
        body: params,
    });
}

// ─── Receipts (public) ───────────────────────────────────────────────────────

export async function verifyReceipt(sessionId: string) {
    return coalFetch<{
        checkoutId: string;
        status: string;
        verified: boolean;
        merchant?: { name: string };
        payment?: {
            amount: string;
            currency: string;
            txHash: string;
            explorerUrl: string;
        };
        proofTrail?: {
            storage?: { storageUri: string; storageRoot: string; explorerUrl: string | null } | null;
            chain?: { anchorTxHash: string; anchorContract: string; explorerUrl: string } | null;
        } | null;
    }>(`/api/receipts/${encodeURIComponent(sessionId)}`);
}

// ─── 0G Health (public) ──────────────────────────────────────────────────────

export async function get0gHealth() {
    return coalFetch<{
        status: string;
        checks: Record<string, { ok: boolean; details?: unknown }>;
    }>('/api/0g/health');
}
