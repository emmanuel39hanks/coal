/**
 * /.well-known/x402.json
 *
 * x402 Bazaar-compatible manifest listing all of this merchant's
 * x402 paywall endpoints. Any x402-aware agent crawler (or the Coinbase
 * Bazaar indexer) can discover and pay these paywalls autonomously.
 */

import { createX402ManifestRoute } from 'coal-react/next';

const MERCHANT_ID =
    process.env.NEXT_PUBLIC_COAL_MERCHANT_ID || 'lst00PqEWRwcM4roiOcSpD8WfxlBc2hH';
const COAL_API_URL = process.env.NEXT_PUBLIC_COAL_API_URL || 'https://api.usecoal.xyz';

export const GET = createX402ManifestRoute({
    merchantId: MERCHANT_ID,
    apiUrl: COAL_API_URL,
});
