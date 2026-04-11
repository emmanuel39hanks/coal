/**
 * /.well-known/x402.json
 *
 * x402 Bazaar–compatible manifest listing any x402 paywall endpoints
 * this store exposes. For a pure physical-goods store this is usually
 * empty, but the file still exists at the well-known path so crawlers
 * know the site opts in to the x402 discovery protocol.
 */

import { createX402ManifestRoute } from "coal-react/next";

const MERCHANT_ID =
  process.env.NEXT_PUBLIC_COAL_MERCHANT_ID || "lst00PqEWRwcM4roiOcSpD8WfxlBc2hH";
const COAL_API_URL =
  process.env.NEXT_PUBLIC_COAL_API_URL || "https://api.usecoal.xyz";

export const GET = createX402ManifestRoute({
  merchantId: MERCHANT_ID,
  apiUrl: COAL_API_URL,
});
