/**
 * Thin Coal backend client for the Mini App.
 *
 * All browsing endpoints are public. Session creation uses the
 * public /api/pay/session endpoint keyed by payment-link slugs —
 * no merchant API key required on the client.
 *
 * Coal's `apiSuccess` helper returns the payload directly (no `{data: ...}`
 * wrapper), so every response here is the object we care about.
 */

const COAL_API_URL = process.env.NEXT_PUBLIC_COAL_API_URL || '/coal-proxy';

// ngrok free plan intercepts Mozilla-User-Agent requests with a warning page.
// Sending any value for this header bypasses it. Harmless elsewhere.
const COMMON_HEADERS = { 'ngrok-skip-browser-warning': 'true' };

export interface ResolvedLink {
    id: string;
    slug: string;
    active: boolean;
    title: string | null;
    description: string | null;
    merchantId: string;
    productId: string | null;
    product: {
        id: string;
        name: string;
        description: string | null;
        price: string;
        image: string | null;
    } | null;
    merchant: {
        name: string | null;
        image: string | null;
        payoutAddress: `0x${string}` | null;
    };
}

/**
 * Resolve a payment-link slug to a product snapshot + link metadata.
 */
export async function resolveLink(slug: string): Promise<{ data: ResolvedLink }> {
    const res = await fetch(`${COAL_API_URL}/api/resolve/link?slug=${encodeURIComponent(slug)}`, {
        headers: COMMON_HEADERS,
    });
    if (!res.ok) {
        throw new Error(`Failed to resolve link ${slug}: ${res.status}`);
    }
    const data = (await res.json()) as ResolvedLink;
    // Wrap so callers see a consistent `{ data }` shape even if the backend
    // flattens; keeps component code readable.
    return { data };
}

/**
 * Create a World-Chain-settled payment session for a given link.
 */
export async function createWorldChainSession(linkId: string, opts?: { payerEmail?: string }) {
    const res = await fetch(`${COAL_API_URL}/api/pay/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...COMMON_HEADERS },
        body: JSON.stringify({
            linkId,
            chain: 'worldchain',
            customerEmail: opts?.payerEmail,
        }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || `Failed to create session: ${res.status}`);
    }
    const body = (await res.json()) as { sessionId: string };
    return { data: body };
}

/**
 * Notify the backend that the payer submitted a tx on World Chain.
 */
export async function confirmSession(sessionId: string, txHash: string, payerAddress: string) {
    const res = await fetch(`${COAL_API_URL}/api/pay/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...COMMON_HEADERS },
        body: JSON.stringify({ sessionId, txHash, payerAddress }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || `Failed to confirm: ${res.status}`);
    }
    return (await res.json()) as { status: string; sessionId: string };
}

export async function getSessionStatus(sessionId: string) {
    const res = await fetch(`${COAL_API_URL}/api/pay/status/${encodeURIComponent(sessionId)}`, {
        headers: COMMON_HEADERS,
    });
    if (!res.ok) throw new Error(`Session status failed: ${res.status}`);
    return (await res.json()) as { id: string; status: string; txHash: string | null };
}

export async function getProducts(limit = 10) {
    const res = await fetch(`${COAL_API_URL}/api/pay/products?limit=${limit}`, {
        headers: COMMON_HEADERS,
    });
    if (!res.ok) throw new Error(`Failed to load products: ${res.status}`);
    return (await res.json()) as {
        products: {
            linkId: string;
            linkSlug: string;
            name: string;
            description: string | null;
            price: string;
            image: string | null;
            merchantName: string | null;
            payoutAddress: string;
        }[];
    };
}

export async function getOrderHistory(address: string) {
    const res = await fetch(
        `${COAL_API_URL}/api/pay/history?address=${encodeURIComponent(address)}`,
        { headers: COMMON_HEADERS },
    );
    if (!res.ok) throw new Error(`Order history failed: ${res.status}`);
    return (await res.json()) as {
        orders: {
            id: string;
            amount: string;
            currency: string;
            txHash: string | null;
            explorerUrl: string | null;
            chain: string;
            createdAt: string;
            product: { name: string; image: string | null; description: string | null } | null;
        }[];
    };
}

export async function getReceipt(sessionId: string) {
    const res = await fetch(`${COAL_API_URL}/api/receipts/${encodeURIComponent(sessionId)}`, {
        headers: COMMON_HEADERS,
    });
    if (!res.ok) throw new Error(`Receipt fetch failed: ${res.status}`);
    return (await res.json()) as {
        checkoutId: string;
        status: string;
        verified: boolean;
        payment?: {
            amount: string;
            currency: string;
            txHash: string;
            chain?: string;
            chainId?: number;
            chainName?: string;
            explorerUrl: string;
        };
        proofTrail: unknown;
    };
}
