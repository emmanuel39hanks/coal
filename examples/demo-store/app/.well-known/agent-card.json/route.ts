/**
 * /.well-known/agent-card.json
 *
 * A2A Agent Card (Google + Linux Foundation spec) for this demo store.
 * Any A2A-capable agent crawling the web per RFC 8615 can find this
 * merchant here. Served from coal-react/next's createAgentCardRoute()
 * which pulls the merchant profile from Coal's public agent API (backed
 * by 0G Storage + KV).
 */

import { createAgentCardRoute } from "coal-react/next";

const MERCHANT_ID =
  process.env.NEXT_PUBLIC_COAL_MERCHANT_ID || "lst00PqEWRwcM4roiOcSpD8WfxlBc2hH";
const COAL_API_URL =
  process.env.NEXT_PUBLIC_COAL_API_URL || "https://api.usecoal.xyz";

export const GET = createAgentCardRoute({
  merchantId: MERCHANT_ID,
  apiUrl: COAL_API_URL,
});
