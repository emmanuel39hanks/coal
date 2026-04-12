/**
 * Coal MCP Server
 *
 * Wraps Coal's agent REST API as MCP tools so any MCP-compatible AI
 * (Claude, ChatGPT, Gemini, Cursor, etc.) can discover merchants, search
 * products, create checkouts, verify receipts, and query merchant memory
 * — all through a single MCP connection.
 *
 * The server is stateless: every tool call translates into an HTTP request
 * to api.usecoal.xyz. No database, no 0G SDK, no Prisma. Deploy anywhere.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as coal from './coal-api';

export function createCoalMcpServer(): McpServer {
    const server = new McpServer({
        name: 'coal-commerce',
        version: '1.0.0',
    });

    // ─── Discovery (read-only, no auth) ──────────────────────────────────

    server.tool(
        'discover_merchants',
        'Browse all merchants on Coal with their products, paywalls, and 0G publication status. ' +
            'Returns the top 5 products and paywalls per merchant plus aggregate stats. ' +
            'Use this as the starting point when a user asks about buying something or wants to see what\'s available.',
        {},
        async () => {
            try {
                const data = await coal.discoverMerchants();
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(data, null, 2),
                        },
                    ],
                };
            } catch (err) {
                return errorResult(err);
            }
        },
    );

    server.tool(
        'search_products',
        'Search products across all Coal merchants. Filter by name (fuzzy match), maximum price, or tag. ' +
            'Use this when the user is looking for something specific like "find me an API under $1" or "search for coffee".',
        {
            search: z.string().optional().describe('Product name search (case-insensitive fuzzy match)'),
            maxPrice: z.number().optional().describe('Maximum price in USD'),
            tag: z.string().optional().describe('Filter by product tag'),
        },
        async ({ search, maxPrice, tag }) => {
            try {
                const data = await coal.searchProducts({ search, maxPrice, tag });
                return {
                    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
                };
            } catch (err) {
                return errorResult(err);
            }
        },
    );

    server.tool(
        'get_merchant_profile',
        'Get the full profile of a specific Coal merchant including their products, paywalls, ' +
            'supported networks/tokens, capabilities, API endpoints, and 0G Storage proof (root hash + URI). ' +
            'Use this to get details about a specific merchant before creating a checkout.',
        {
            merchantId: z.string().describe('The Coal merchant ID (e.g. "lst00PqEWRwcM4roiOcSpD8WfxlBc2hH")'),
        },
        async ({ merchantId }) => {
            try {
                const data = await coal.getMerchantProfile(merchantId);
                return {
                    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
                };
            } catch (err) {
                return errorResult(err);
            }
        },
    );

    // ─── Agent Commerce (AI-powered queries) ─────────────────────────────

    server.tool(
        'query_merchant_memory',
        'Ask a natural language question about a merchant\'s products, policies, or catalog. ' +
            'Powered by 0G Compute with optional Sealed Inference (TEE) for privacy. ' +
            'Examples: "What refund policy does this merchant have?", "Which product is cheapest?", ' +
            '"Does this merchant sell digital products?"',
        {
            merchantId: z.string().describe('The Coal merchant ID to query'),
            question: z.string().describe('Natural language question about the merchant'),
        },
        async ({ merchantId, question }) => {
            try {
                const data = await coal.queryMerchantMemory({ merchantId, question });
                return {
                    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
                };
            } catch (err) {
                return errorResult(err);
            }
        },
    );

    // ─── Paywalls (x402 protocol) ────────────────────────────────────────

    server.tool(
        'check_paywall',
        'Check whether an address has paid for access to a specific x402 paywall. ' +
            'Returns 402 Payment Required with pricing info if not paid, or 200 OK with content if paid. ' +
            'Use this to check paywall status before and after payment.',
        {
            paywallId: z.string().describe('The paywall ID to check'),
            address: z.string().optional().describe('The wallet address to check access for. If omitted, returns the paywall pricing info.'),
        },
        async ({ paywallId, address }) => {
            try {
                const data = await coal.checkPaywall(paywallId, address);
                return {
                    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
                };
            } catch (err) {
                // 402 is expected for unpaid paywalls — surface the pricing info
                const msg = err instanceof Error ? err.message : String(err);
                if (msg.includes('402')) {
                    return {
                        content: [
                            {
                                type: 'text',
                                text: `Paywall requires payment. ${msg}\n\nTo access this paywall, create a checkout for the paywall amount and pay it, then re-check with the payer address.`,
                            },
                        ],
                    };
                }
                return errorResult(err);
            }
        },
    );

    // ─── Checkout & Payment (requires COAL_API_KEY) ──────────────────────

    server.tool(
        'create_checkout',
        'Create a Coal checkout session to pay for a product or a custom amount. ' +
            'Returns a checkout URL where the payment can be completed, plus the session ID for tracking. ' +
            'The checkout settles in USDC on Base (~2 second finality). ' +
            'After payment, use verify_receipt to see the 3-step proof trail on 0G.',
        {
            amount: z.number().positive().describe('Payment amount in USD (settles in USDC)'),
            productId: z.string().optional().describe('Optional Coal product ID to link the checkout to'),
            productName: z.string().optional().describe('Product name shown on the checkout page'),
            description: z.string().optional().describe('Payment description'),
            currency: z.string().optional().default('USDC').describe('Settlement currency (default: USDC)'),
        },
        async ({ amount, productId, productName, description, currency }) => {
            try {
                const data = await coal.createCheckout({
                    amount,
                    productId,
                    productName,
                    description,
                    currency,
                });
                return {
                    content: [
                        {
                            type: 'text',
                            text: [
                                `Checkout created successfully.`,
                                ``,
                                `Session ID: ${data.id}`,
                                `Checkout URL: ${data.url}`,
                                `Amount: ${data.amount} ${data.currency}`,
                                `Status: ${data.status}`,
                                `Expires: ${data.expiresAt}`,
                                ``,
                                `The user needs to visit the checkout URL to complete the payment.`,
                                `After payment, use get_checkout_status or verify_receipt with session ID "${data.id}" to check the result.`,
                            ].join('\n'),
                        },
                    ],
                };
            } catch (err) {
                return errorResult(err);
            }
        },
    );

    server.tool(
        'get_checkout_status',
        'Check the payment status of a checkout session. ' +
            'Returns: pending (not yet paid), verifying (payment submitted, on-chain verification in progress), ' +
            'confirmed (paid and verified), expired, or failed.',
        {
            sessionId: z.string().describe('The checkout session ID returned by create_checkout'),
        },
        async ({ sessionId }) => {
            try {
                const data = await coal.getCheckoutStatus(sessionId);
                return {
                    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
                };
            } catch (err) {
                return errorResult(err);
            }
        },
    );

    // ─── Receipts & Verification ─────────────────────────────────────────

    server.tool(
        'verify_receipt',
        'Verify a payment receipt and see its 3-step proof trail on 0G: ' +
            '(1) Base TX confirmed, (2) Receipt published to 0G Storage (immutable), ' +
            '(3) Hash anchored on 0G Chain (tamper-proof). ' +
            'Use this after a payment to prove it happened.',
        {
            sessionId: z.string().describe('The checkout session ID to verify'),
        },
        async ({ sessionId }) => {
            try {
                const data = await coal.verifyReceipt(sessionId);

                const steps = [];
                steps.push(`Payment Status: ${data.status}`);
                steps.push(`Verified: ${data.verified}`);

                if (data.payment) {
                    steps.push(`\n--- Payment ---`);
                    steps.push(`Amount: ${data.payment.amount} ${data.payment.currency}`);
                    steps.push(`TX: ${data.payment.txHash}`);
                    steps.push(`Explorer: ${data.payment.explorerUrl}`);
                }

                if (data.proofTrail?.storage) {
                    steps.push(`\n--- 0G Storage (Step 2) ---`);
                    steps.push(`Storage URI: ${data.proofTrail.storage.storageUri}`);
                    steps.push(`Root Hash: ${data.proofTrail.storage.storageRoot}`);
                    if (data.proofTrail.storage.explorerUrl) {
                        steps.push(`StorageScan: ${data.proofTrail.storage.explorerUrl}`);
                    }
                }

                if (data.proofTrail?.chain) {
                    steps.push(`\n--- 0G Chain Anchor (Step 3) ---`);
                    steps.push(`Anchor TX: ${data.proofTrail.chain.anchorTxHash}`);
                    steps.push(`Contract: ${data.proofTrail.chain.anchorContract}`);
                    steps.push(`ChainScan: ${data.proofTrail.chain.explorerUrl}`);
                }

                return {
                    content: [{ type: 'text', text: steps.join('\n') }],
                };
            } catch (err) {
                return errorResult(err);
            }
        },
    );

    // ─── 0G Health ───────────────────────────────────────────────────────

    server.tool(
        'get_0g_health',
        'Check the live status of all 5 0G components used by Coal: ' +
            'Storage (immutable receipts), Chain (proof anchoring), Compute (AI inference), ' +
            'KV (merchant discovery mirror), and DA (payment event streaming). ' +
            'All should show ok: true when healthy.',
        {},
        async () => {
            try {
                const data = await coal.get0gHealth();
                const lines = [`Overall: ${data.status}\n`];
                for (const [name, check] of Object.entries(data.checks)) {
                    lines.push(
                        `${name.toUpperCase().padEnd(10)} ${check.ok ? '✓ OK' : '✗ FAIL'}`,
                    );
                }
                return {
                    content: [{ type: 'text', text: lines.join('\n') }],
                };
            } catch (err) {
                return errorResult(err);
            }
        },
    );

    return server;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function errorResult(err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
        content: [{ type: 'text' as const, text: `Error: ${message}` }],
        isError: true,
    };
}
