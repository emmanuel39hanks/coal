/**
 * Coal MCP Server — Serverless-compatible JSON-RPC handler
 *
 * Implements the MCP protocol (initialize, tools/list, tools/call) as a
 * stateless JSON-RPC 2.0 endpoint. Each request is independent — no session
 * tracking needed. Works on Vercel, Cloudflare Workers, any serverless env.
 *
 * Connect from Claude Code:
 *   claude mcp add coal-commerce --transport http https://mcp.usecoal.xyz/api/mcp
 *
 * Connect from Claude Desktop (claude_desktop_config.json):
 *   { "mcpServers": { "coal": { "url": "https://mcp.usecoal.xyz/api/mcp" } } }
 */

import * as coal from '@/lib/coal-api';

// ─── Tool definitions ────────────────────────────────────────────────────────

interface ToolDef {
    name: string;
    description: string;
    inputSchema: {
        type: 'object';
        properties: Record<string, { type: string; description: string; default?: unknown }>;
        required?: string[];
    };
    handler: (args: Record<string, unknown>) => Promise<string>;
}

const tools: ToolDef[] = [
    {
        name: 'discover_merchants',
        description:
            'Browse all merchants on Coal with their products, paywalls, and 0G publication status. ' +
            'Use this when a user asks about buying something or wants to see what\'s available.',
        inputSchema: { type: 'object', properties: {}, required: [] },
        handler: async () => JSON.stringify(await coal.discoverMerchants(), null, 2),
    },
    {
        name: 'search_products',
        description:
            'Search products across all Coal merchants. Filter by name, max price, or tag. ' +
            'Use this when looking for something specific like "find an API under $1".',
        inputSchema: {
            type: 'object',
            properties: {
                search: { type: 'string', description: 'Product name search (fuzzy)' },
                maxPrice: { type: 'number', description: 'Maximum price in USD' },
                tag: { type: 'string', description: 'Filter by product tag' },
            },
        },
        handler: async (args) =>
            JSON.stringify(
                await coal.searchProducts({
                    search: args.search as string | undefined,
                    maxPrice: args.maxPrice as number | undefined,
                    tag: args.tag as string | undefined,
                }),
                null,
                2,
            ),
    },
    {
        name: 'get_merchant_profile',
        description:
            'Get the full profile of a Coal merchant including products, paywalls, ' +
            'supported networks/tokens, and 0G Storage proof (root hash + URI).',
        inputSchema: {
            type: 'object',
            properties: {
                merchantId: { type: 'string', description: 'Coal merchant ID' },
            },
            required: ['merchantId'],
        },
        handler: async (args) =>
            JSON.stringify(await coal.getMerchantProfile(args.merchantId as string), null, 2),
    },
    {
        name: 'query_merchant_memory',
        description:
            'Ask a natural language question about a merchant\'s products, policies, or catalog. ' +
            'Powered by 0G Compute with Sealed Inference (TEE). Requires a Coal API key.',
        inputSchema: {
            type: 'object',
            properties: {
                merchantId: { type: 'string', description: 'Coal merchant ID' },
                question: { type: 'string', description: 'Natural language question' },
            },
            required: ['merchantId', 'question'],
        },
        handler: async (args) =>
            JSON.stringify(
                await coal.queryMerchantMemory({
                    merchantId: args.merchantId as string,
                    question: args.question as string,
                }),
                null,
                2,
            ),
    },
    {
        name: 'check_paywall',
        description:
            'Check whether an address has paid for a specific x402 paywall. ' +
            'Returns pricing info if not paid, or content access status if paid.',
        inputSchema: {
            type: 'object',
            properties: {
                paywallId: { type: 'string', description: 'Paywall ID' },
                address: { type: 'string', description: 'Wallet address to check (optional)' },
            },
            required: ['paywallId'],
        },
        handler: async (args) => {
            try {
                return JSON.stringify(
                    await coal.checkPaywall(args.paywallId as string, args.address as string | undefined),
                    null,
                    2,
                );
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                if (msg.includes('402')) {
                    return `Paywall requires payment. ${msg}\n\nCreate a checkout for the paywall amount, pay it, then re-check with the payer address.`;
                }
                throw err;
            }
        },
    },
    {
        name: 'create_checkout',
        description:
            'Create a Coal checkout session to pay for a product or amount. ' +
            'Settles in USDC on Base (~2s). Returns a checkout URL. Requires a Coal API key.',
        inputSchema: {
            type: 'object',
            properties: {
                amount: { type: 'number', description: 'Payment amount in USD' },
                productId: { type: 'string', description: 'Optional Coal product ID' },
                productName: { type: 'string', description: 'Product name for the checkout page' },
                description: { type: 'string', description: 'Payment description' },
            },
            required: ['amount'],
        },
        handler: async (args) => {
            const data = await coal.createCheckout({
                amount: args.amount as number,
                productId: args.productId as string | undefined,
                productName: args.productName as string | undefined,
                description: args.description as string | undefined,
            });
            return [
                `Checkout created.`,
                `Session ID: ${data.id}`,
                `Checkout URL: ${data.url}`,
                `Amount: ${data.amount} ${data.currency}`,
                `Status: ${data.status}`,
                `Expires: ${data.expiresAt}`,
                ``,
                `The user needs to visit the checkout URL to pay, OR an agent can pay via ERC-3009.`,
                `After payment, use verify_receipt with session ID "${data.id}".`,
            ].join('\n');
        },
    },
    {
        name: 'get_checkout_status',
        description:
            'Check the payment status of a checkout session: pending, verifying, confirmed, expired, failed.',
        inputSchema: {
            type: 'object',
            properties: {
                sessionId: { type: 'string', description: 'Checkout session ID' },
            },
            required: ['sessionId'],
        },
        handler: async (args) =>
            JSON.stringify(await coal.getCheckoutStatus(args.sessionId as string), null, 2),
    },
    {
        name: 'verify_receipt',
        description:
            'Verify a payment receipt and see its 3-step proof trail: ' +
            '(1) Base TX, (2) 0G Storage receipt, (3) 0G Chain anchor.',
        inputSchema: {
            type: 'object',
            properties: {
                sessionId: { type: 'string', description: 'Checkout session ID' },
            },
            required: ['sessionId'],
        },
        handler: async (args) => {
            const data = await coal.verifyReceipt(args.sessionId as string);
            const lines = [`Status: ${data.status}`, `Verified: ${data.verified}`];
            if (data.payment) {
                lines.push(`\n--- Payment ---`);
                lines.push(`Amount: ${data.payment.amount} ${data.payment.currency}`);
                lines.push(`TX: ${data.payment.txHash}`);
                lines.push(`Explorer: ${data.payment.explorerUrl}`);
            }
            if (data.proofTrail?.storage) {
                lines.push(`\n--- 0G Storage ---`);
                lines.push(`URI: ${data.proofTrail.storage.storageUri}`);
                lines.push(`Root: ${data.proofTrail.storage.storageRoot}`);
                if (data.proofTrail.storage.explorerUrl) lines.push(`StorageScan: ${data.proofTrail.storage.explorerUrl}`);
            }
            if (data.proofTrail?.chain) {
                lines.push(`\n--- 0G Chain ---`);
                lines.push(`Anchor: ${data.proofTrail.chain.anchorTxHash}`);
                lines.push(`Contract: ${data.proofTrail.chain.anchorContract}`);
                lines.push(`ChainScan: ${data.proofTrail.chain.explorerUrl}`);
            }
            return lines.join('\n');
        },
    },
    {
        name: 'get_0g_health',
        description:
            'Check the live status of all 5 0G components: Storage, Chain, Compute, KV, DA.',
        inputSchema: { type: 'object', properties: {}, required: [] },
        handler: async () => {
            const data = await coal.get0gHealth();
            const lines = [`Overall: ${data.status}\n`];
            for (const [name, check] of Object.entries(data.checks)) {
                lines.push(`${name.toUpperCase().padEnd(10)} ${check.ok ? '✓ OK' : '✗ FAIL'}`);
            }
            return lines.join('\n');
        },
    },
];

// ─── JSON-RPC 2.0 dispatcher ────────────────────────────────────────────────

function jsonRpcResponse(id: unknown, result: unknown) {
    return { jsonrpc: '2.0', id, result };
}

function jsonRpcError(id: unknown, code: number, message: string) {
    return { jsonrpc: '2.0', id, error: { code, message } };
}

async function handleJsonRpc(msg: { id?: unknown; method?: string; params?: Record<string, unknown> }) {
    const { id, method, params } = msg;

    switch (method) {
        case 'initialize':
            return jsonRpcResponse(id, {
                protocolVersion: '2025-03-26',
                capabilities: { tools: { listChanged: false } },
                serverInfo: { name: 'coal-commerce', version: '1.0.0' },
            });

        case 'notifications/initialized':
            // No response needed for notifications
            return null;

        case 'tools/list':
            return jsonRpcResponse(id, {
                tools: tools.map((t) => ({
                    name: t.name,
                    description: t.description,
                    inputSchema: t.inputSchema,
                })),
            });

        case 'tools/call': {
            const toolName = params?.name as string;
            const toolArgs = (params?.arguments ?? {}) as Record<string, unknown>;
            const tool = tools.find((t) => t.name === toolName);
            if (!tool) {
                return jsonRpcError(id, -32601, `Unknown tool: ${toolName}`);
            }
            try {
                const result = await tool.handler(toolArgs);
                return jsonRpcResponse(id, {
                    content: [{ type: 'text', text: result }],
                });
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                return jsonRpcResponse(id, {
                    content: [{ type: 'text', text: `Error: ${message}` }],
                    isError: true,
                });
            }
        }

        case 'ping':
            return jsonRpcResponse(id, {});

        default:
            return jsonRpcError(id, -32601, `Method not found: ${method}`);
    }
}

// ─── HTTP handlers ───────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return Response.json(jsonRpcError(null, -32700, 'Parse error: Invalid JSON'));
    }

    // Handle JSON-RPC batch (array of messages)
    if (Array.isArray(body)) {
        const responses: unknown[] = [];
        for (const msg of body) {
            const res = await handleJsonRpc(msg);
            if (res) responses.push(res);
        }
        return Response.json(responses);
    }

    // Single message
    const result = await handleJsonRpc(body as { id?: unknown; method?: string; params?: Record<string, unknown> });
    if (!result) {
        // Notifications don't get a response
        return new Response(null, { status: 204 });
    }
    return Response.json(result);
}

export async function GET(): Promise<Response> {
    return Response.json({
        name: 'coal-commerce',
        version: '1.0.0',
        description: 'Coal MCP Server — payment rails for humans and AI agents on 0G',
        endpoint: '/api/mcp',
        transport: 'streamable-http (stateless)',
        tools: tools.length,
        toolNames: tools.map((t) => t.name),
        docs: 'https://usecoal.xyz/docs/sdk/react',
        connect: 'claude mcp add coal-commerce --transport http https://mcp.usecoal.xyz/api/mcp',
    });
}

export async function DELETE(): Promise<Response> {
    return new Response(null, { status: 204 });
}
