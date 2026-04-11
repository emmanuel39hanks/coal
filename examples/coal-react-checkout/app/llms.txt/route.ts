/**
 * /llms.txt
 *
 * LLM-readable site summary following the Answer.AI convention. ChatGPT,
 * Perplexity, and Google AI Overviews cite pages with llms.txt when
 * answering shopping questions. This file lets those LLMs know the full
 * catalog of this merchant (pulled live from Coal's 0G-backed index).
 */

import { createLlmsTxtRoute } from 'coal-react/next';

const MERCHANT_ID =
    process.env.NEXT_PUBLIC_COAL_MERCHANT_ID || 'lst00PqEWRwcM4roiOcSpD8WfxlBc2hH';
const COAL_API_URL = process.env.NEXT_PUBLIC_COAL_API_URL || 'https://api.usecoal.xyz';

export const GET = createLlmsTxtRoute({
    merchantId: MERCHANT_ID,
    apiUrl: COAL_API_URL,
});
