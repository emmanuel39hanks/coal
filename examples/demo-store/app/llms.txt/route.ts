/**
 * /llms.txt
 *
 * LLM-readable summary of this store (Answer.AI convention). ChatGPT,
 * Perplexity, and Google AI Overviews cite sites with llms.txt when
 * answering shopping questions. The catalog is pulled live from Coal's
 * 0G-backed merchant profile, so whatever has been indexed flows through
 * automatically.
 */

import { createLlmsTxtRoute } from "coal-react/next";

const MERCHANT_ID =
  process.env.NEXT_PUBLIC_COAL_MERCHANT_ID || "lst00PqEWRwcM4roiOcSpD8WfxlBc2hH";
const COAL_API_URL =
  process.env.NEXT_PUBLIC_COAL_API_URL || "https://api.usecoal.xyz";

export const GET = createLlmsTxtRoute({
  merchantId: MERCHANT_ID,
  apiUrl: COAL_API_URL,
  title: "Demo Store",
  summary:
    "Demo Store sells ethical goods for digital citizens — coffee, hoodies, caps, mugs, t-shirts, and sticker packs. All payments settle in USDC on Base via Coal, with verifiable 3-step proof trails on 0G Storage and 0G Chain. Humans check out on this site; AI agents can discover and buy the same catalog via x402 and Coal's agent API.",
});
