const COAL_API_URL = process.env.COAL_API_URL || 'https://api.usecoal.xyz';
const COAL_API_KEY = process.env.COAL_API_KEY || '';
const TIMEOUT_MS = 30_000;

async function publicGet(path: string) {
  const res = await fetch(`${COAL_API_URL}${path}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(body.error?.message || `${res.status} ${res.statusText}`);
  }
  return res.json();
}

async function authedPost(path: string, body?: Record<string, unknown>) {
  if (!COAL_API_KEY) throw new Error('COAL_API_KEY is not configured');
  const res = await fetch(`${COAL_API_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': COAL_API_KEY,
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(data.error?.message || `${res.status} ${res.statusText}`);
  }
  return res.json();
}

async function authedGet(path: string) {
  if (!COAL_API_KEY) throw new Error('COAL_API_KEY is not configured');
  const res = await fetch(`${COAL_API_URL}${path}`, {
    headers: { 'x-api-key': COAL_API_KEY },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(data.error?.message || `${res.status} ${res.statusText}`);
  }
  return res.json();
}

// Discovery endpoints (public, no auth)
export function discoverMerchants() {
  return publicGet('/api/agent/discover');
}

export function discoverProducts(opts: { search?: string; maxPrice?: number; tag?: string } = {}) {
  const params = new URLSearchParams();
  if (opts.search) params.set('search', opts.search);
  if (opts.maxPrice) params.set('maxPrice', String(opts.maxPrice));
  if (opts.tag) params.set('tag', opts.tag);
  const qs = params.toString();
  return publicGet(`/api/agent/discover/products${qs ? `?${qs}` : ''}`);
}

export function discoverPaywalls() {
  return publicGet('/api/agent/discover/paywalls');
}

// Public endpoints (no auth)
export function getMerchantProfile(merchantId: string) {
  return publicGet(`/api/agent/merchant-profiles/${merchantId}`);
}

export function getPaywallManifest(paywallId: string) {
  return publicGet(`/api/agent/paywalls/${paywallId}/manifest`);
}

export async function checkPaywallAccess(paywallId: string, opts: { address?: string; agentId?: string } = {}) {
  const params = new URLSearchParams();
  if (opts.address) params.set('address', opts.address);
  if (opts.agentId) params.set('agentId', opts.agentId);
  const qs = params.toString();
  const path = `/api/agent/paywalls/${paywallId}/verify${qs ? `?${qs}` : ''}`;

  const res = await fetch(`${COAL_API_URL}${path}`);
  const body = await res.json().catch(() => ({}));

  if (res.status === 402) {
    const x402 = res.headers.get('X-PAYMENT');
    let paymentRequirements = null;
    if (x402) {
      try {
        paymentRequirements = JSON.parse(Buffer.from(x402, 'base64').toString('utf-8'));
      } catch { /* ignore */ }
    }
    return { paymentRequired: true, status: 402, paymentRequirements, ...body };
  }
  if (!res.ok) throw new Error(body.error?.message || `${res.status}`);
  return { paymentRequired: false, ...body };
}

export function verifyReceipt(checkoutId: string) {
  return publicGet(`/api/receipts/${checkoutId}`);
}

// Authenticated endpoints
export function createCheckout(opts: { amount: number; currency?: string; description?: string; productName?: string }) {
  return authedPost('/api/agent/checkout', opts);
}

export function queryMemory(query: string) {
  return authedPost('/api/agent/memory/query', { query });
}

export function routeCommerce(goal: string) {
  return authedPost('/api/agent/commerce/route', { goal });
}

export function getRecommendations(goal: string) {
  return authedPost('/api/agent/commerce/recommend', { goal });
}

export function evaluatePolicy(scenario: string) {
  return authedPost('/api/agent/commerce/policy-eval', { scenario });
}

export function createPaywallPayIntent(paywallId: string, opts: { walletAddress?: string; agentId?: string } = {}) {
  return authedPost(`/api/agent/paywalls/${paywallId}/pay-intent`, opts);
}

export function verifyReceiptAuth(checkoutId: string) {
  return authedGet(`/api/agent/receipts/${checkoutId}/verify`);
}

// Payment confirmation (public endpoint — no API key needed)
export async function confirmPayment(sessionId: string, txHash: string, payerAddress?: string) {
  const res = await fetch(`${COAL_API_URL}/api/pay/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, txHash, payerAddress }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(data.error?.message || `${res.status} ${res.statusText}`);
  }
  return res.json();
}
