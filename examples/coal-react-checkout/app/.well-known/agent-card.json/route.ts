/**
 * /.well-known/agent-card.json
 *
 * A2A Agent Card served from this merchant's site. Any A2A-capable agent
 * crawling the web can find this merchant here per RFC 8615 well-known URI
 * convention.
 *
 * Under the hood, createAgentCardRoute() fetches the merchant's profile from
 * Coal's public agent API (which is backed by 0G Storage + KV) and transforms
 * it into the A2A Agent Card format.
 */

import { createAgentCardRoute } from 'coal-react/next';

const MERCHANT_ID =
    process.env.NEXT_PUBLIC_COAL_MERCHANT_ID || 'lst00PqEWRwcM4roiOcSpD8WfxlBc2hH';
const COAL_API_URL = process.env.NEXT_PUBLIC_COAL_API_URL || 'https://api.usecoal.xyz';

export const GET = createAgentCardRoute({
    merchantId: MERCHANT_ID,
    apiUrl: COAL_API_URL,
});
