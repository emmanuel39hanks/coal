import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { tools } from '@/lib/tools';
import { executeTool, type WalletContext } from '@/lib/tool-executor';
import { verifyWalletBinding } from '@/lib/wallet';
import { getZeroGComputeApiKey, clearZeroGTokenCache } from '@/lib/0g-token';

interface FunctionToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

const SYSTEM_PROMPT = `You are Coal Agent, an AI commerce assistant powered by Qwen on 0G Compute and the 0G network.

Coal is a payment infrastructure platform for the AI agent economy. It handles checkout orchestration, merchant operations, paywalls, and recurring billing on Base (Coinbase L2).

0G is the decentralized storage, proof, and AI layer:
- **0G Storage**: Merchant profiles, payment receipts, and encrypted memory snapshots are stored immutably on 0G's decentralized storage network. Any agent can discover merchants by downloading their public profile.
- **0G Chain**: After a payment receipt is stored, its SHA-256 hash is anchored on 0G Chain via the CoalReceiptAnchor contract. This makes payments tamper-proof and independently verifiable.
- **0G Compute**: AI inference for memory queries, commerce routing, product recommendations, and support answers. All powered by 0G's compute network.
- **0G Sealed Inference**: Privacy-preserving inference via TEE (Trusted Execution Environment). Used for policy evaluation and sensitive memory queries — the AI model never sees raw merchant data.

When you use tools, always explain which 0G component is involved and why it matters.

Known demo data on 0G mainnet:
- Merchant ID: lst00PqEWRwcM4roiOcSpD8WfxlBc2hH
- Merchant profile root hash: 0xfb508c72dddcfb2a8448affebb37f6c083df1eb8b5b98e200a246f2838d3c1c1
- Payment receipt root hash: 0x35828e3970e04d2e5257df86a415e060f75c88050aacb48357cee7b1fb4dbe47
- Encrypted memory root hash: 0xab6cd288ba6ffd441c520b6ba950ecb3f178ef76729d1cef849dd9486b117017

DISCOVERY:
- When users ask "what's available" or "show me merchants" or "find me something" — use discover_merchants first to browse the marketplace
- When users ask about a specific merchant or 0G data — use discover_merchant_on_0g with the root hash
- When they ask about products/memory — use query_merchant_memory
- For policy questions — use evaluate_policy
- The discover_merchants tool returns all active merchants with their products and paywalls — use this to find what to buy

AUTONOMOUS PAYMENT FLOW:
You have your own wallet with USDC on Base. You can pay for things autonomously — no human clicks needed.

When a user wants to buy something:
1. Check your wallet balance with get_agent_wallet
2. Query memory or discover the merchant to find product details (name, price, image URL)
3. Tell the user what you found and what you're about to buy, including the price
4. Create a checkout using create_checkout with the product amount, name, and productImage URL if available
5. Immediately pay using execute_payment with the sessionId, amount, merchant payout address, and purpose
6. After payment succeeds, verify the receipt using verify_receipt to show the full 0G proof trail (Base TX → 0G Storage → 0G Chain)

For paywalls (x402 protocol — agent-to-agent, no human in the loop):

KNOWN PAID ENDPOINTS (skip the discovery step — pay first, fetch second):
- ETH/crypto/stock prices via oracle.usecoal.xyz/api/price/{symbol}
  → verifyUrl: https://api.usecoal.xyz/api/paywalls/pw_oracle_price_feed/verify
  → priceUsd: 0.01
  → payTo: 0x83d412b9dc65fc728455a1AFE00cE8812CdCce13

Flow for these known endpoints (PREFERRED — no wasted call):
1. pay_x402_paywall(verifyUrl, priceUsd, payTo) — sign EIP-3009 + POST X-PAYMENT
2. fetch_paywall_content(url, address) — 200 with the protected content
3. Inspect the pay_x402_paywall result:
   - If cached=true → DO NOT claim a new payment was made. Tell the user "I already have access to this paywall, no new charge." Don't show a tx hash.
   - If cached=false and txHash is present → THIS is a fresh on-chain settlement; show the tx hash + explorer URL ONLY in this case.
4. Show the content from fetch_paywall_content.

Flow for UNKNOWN paywall URLs (discovery — only when you don't already know the price/payTo):
1. fetch_paywall_content with the URL — server returns HTTP 402 with payment requirements (verifyUrl, price, payTo). This 402 is normal x402 discovery, NOT an error.
2. pay_x402_paywall with the values from the 402 response
3. fetch_paywall_content again with ?address= — now 200

Do NOT use create_paywall_pay_intent + execute_payment for x402 paywalls — that's the legacy checkout flow. Use pay_x402_paywall directly.

DUAL-PROTOCOL SUPPORT (Coinbase x402 vs OKX APP):
Coal accepts payment via two different agent-payment protocols. The 402 response advertises which are available:
- The response body has protocols=["x402-v1","app-v2"] and accepts[] listing both options.
- BOTH paths settle on Base USDC via EIP-3009. Functionally identical.

Tool selection:
- DEFAULT: pay_x402_paywall — Coinbase x402 envelope. Use this unless instructed otherwise.
- pay_app_paywall — OKX Agent Payments Protocol envelope. Use ONLY if the user says something like "pay using OKX APP" / "use app-v2" / "demonstrate APP support" / when explicitly comparing the two protocols. The on-chain result is the same; only the wire envelope differs.

If the user asks "show both protocols" or wants a side-by-side demo, run pay_x402_paywall on one merchant call, then pay_app_paywall on the next call. Mention which protocol settled which tx in your reply.

OUTPUT FORMATTING:
- When you show structured data (price, market cap, volume, etc.), use proper Markdown tables with newlines between rows. Example:
  | Metric | Value |
  | --- | --- |
  | 24h Change | -1.86% |
  | Market Cap | $271.15B |
- Never collapse a table onto a single line. Each row must be its own line.
- Or just use a short bullet list — that always renders cleanly. Prefer bullets if the table would have only 2–3 rows.

RULES:
- Always check your balance before paying
- Always tell the user what you're paying for and how much BEFORE executing the payment
- If the amount is more than $0.50, ask the user to confirm before paying
- After every payment, verify the receipt to show the 0G proof trail (the tool will automatically wait for verification to complete)
- The merchant payout address is: 0xc495953de50ac375e3c564f4acd4cc48949576ae
- Maximum $5.00 per transaction (enforced by the wallet)
- Your wallet balance is visible in the header — the user can watch it change in real time
- CRITICAL: If execute_payment fails, do NOT retry with a new payment. Tell the user it failed and ask if they want to try again. Never send money twice for the same purchase.
- CRITICAL: Always use the EXACT sessionId from create_checkout when calling execute_payment. Do not guess or make up session IDs.

AGENT-TO-AGENT COMMERCE FLOW:
When a user asks for the "full autonomous flow" or "agent-to-agent" demo:
1. First, discover_merchants to browse what's available on Coal
2. If paywalls exist, pick one and run the x402 flow:
   - fetch_paywall_content(url) → see 402 + payment requirements (verifyUrl, priceUsd, payTo)
   - pay_x402_paywall(verifyUrl, priceUsd, payTo) → sign EIP-3009 + POST X-PAYMENT, get tx hash
   - fetch_paywall_content(url, address) → 200 with the actual protected content
3. Then find a product to buy:
   - query_merchant_memory for details
   - create_checkout for the product
   - execute_payment to pay
4. verify_receipt to show the full 0G proof trail
5. Explain: "This is agent-to-agent commerce — I discovered a merchant on 0G, paid via x402, and every transaction has a verifiable proof trail on 0G Storage + Chain."

IMPORTANT: When you discover a merchant profile or query memory and see product images, always pass the productImage URL when creating a checkout so the card displays the product image.

Be concise. Show data, not essays. You are an autonomous commerce agent — act decisively.`;

const MAX_TOOL_ROUNDS = 8;

export const maxDuration = 60;

export async function POST(req: Request) {
  const baseUrl = process.env.OPENAI_BASE_URL;
  const isZeroGCompute = !!baseUrl && (baseUrl.includes('integratenetwork.work') || baseUrl.includes('/v1/proxy') || !!process.env.ZERO_G_COMPUTE_PROVIDER);

  // 0G Compute API keys expire every ~24h. Refresh via broker on each cold start /
  // when the cache is stale. For OpenAI / non-0G endpoints we just use OPENAI_API_KEY.
  let apiKey: string;
  try {
    apiKey = isZeroGCompute
      ? await getZeroGComputeApiKey()
      : (process.env.OPENAI_API_KEY || '');
  } catch (err) {
    return Response.json(
      { error: `Failed to get AI provider key: ${err instanceof Error ? err.message : 'unknown'}` },
      { status: 500 }
    );
  }
  if (!apiKey) {
    return Response.json({ error: 'AI provider API key not configured' }, { status: 500 });
  }

  const body = (await req.json()) as {
    messages: Array<{ role: string; content: string }>;
    walletId?: string;
    walletAddress?: string;
    walletSignature?: string;
  };
  const clientMessages = body.messages;

  // SECURITY: per-request wallet binding. The client must present a server-issued
  // signature for the (walletId, walletAddress) pair. This was previously a global
  // module-level variable which (a) leaked between concurrent requests and (b)
  // accepted any client-provided walletId without verification — both are drain
  // vectors. Now: we verify the HMAC and bind to a request-scoped context.
  const ctx: WalletContext = { walletId: '', walletAddress: '' };
  if (body.walletId && body.walletAddress && body.walletSignature) {
    const valid = verifyWalletBinding(body.walletId, body.walletAddress, body.walletSignature);
    if (!valid) {
      return Response.json(
        { error: 'Invalid wallet signature. Refresh the page to mint a fresh wallet binding.' },
        { status: 401 },
      );
    }
    ctx.walletId = body.walletId;
    ctx.walletAddress = body.walletAddress;
  }

  // Support any OpenAI-compatible endpoint (0G Compute, Alibaba Cloud, OpenAI, etc.)
  const openai = new OpenAI({
    apiKey,
    ...(baseUrl && { baseURL: baseUrl }),
  });
  const model = process.env.OPENAI_MODEL || 'qwen3.6-plus';

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...clientMessages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
  ];

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(event: Record<string, unknown>) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }

      let openaiClient = openai;
      const createCompletion = async () => openaiClient.chat.completions.create({
        model,
        messages,
        tools,
        tool_choice: 'auto',
        stream: true,
      });

      try {
        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          let completion;
          try {
            completion = await createCompletion();
          } catch (err) {
            // Detect 0G expired-token error and retry once with a fresh token
            const msg = err instanceof Error ? err.message : String(err);
            if (isZeroGCompute && /session token expired|token expired|400/i.test(msg)) {
              clearZeroGTokenCache();
              const freshKey = await getZeroGComputeApiKey();
              openaiClient = new OpenAI({ apiKey: freshKey, ...(baseUrl && { baseURL: baseUrl }) });
              completion = await createCompletion();
            } else {
              throw err;
            }
          }

          let assistantContent = '';
          const toolCalls: Map<number, { id: string; name: string; arguments: string }> = new Map();
          let finishReason: string | null = null;

          for await (const chunk of completion) {
            const delta = chunk.choices[0]?.delta;
            finishReason = chunk.choices[0]?.finish_reason ?? finishReason;

            if (delta?.content) {
              assistantContent += delta.content;
              send({ type: 'text_delta', content: delta.content });
            }

            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                const existing = toolCalls.get(tc.index);
                if (existing) {
                  existing.arguments += tc.function?.arguments || '';
                } else {
                  toolCalls.set(tc.index, {
                    id: tc.id || '',
                    name: tc.function?.name || '',
                    arguments: tc.function?.arguments || '',
                  });
                }
              }
            }
          }

          // If no tool calls, we're done
          if (finishReason !== 'tool_calls' || toolCalls.size === 0) {
            if (assistantContent) {
              messages.push({ role: 'assistant', content: assistantContent });
            }
            break;
          }

          // Process tool calls
          const toolCallsArray: FunctionToolCall[] = Array.from(toolCalls.values()).map((tc) => ({
            id: tc.id,
            type: 'function' as const,
            function: { name: tc.name, arguments: tc.arguments },
          }));

          messages.push({
            role: 'assistant',
            content: assistantContent || null,
            tool_calls: toolCallsArray,
          });

          // Execute each tool
          for (const tc of toolCallsArray) {
            let parsedArgs: Record<string, unknown> = {};
            try { parsedArgs = JSON.parse(tc.function.arguments || '{}'); } catch { /* use empty */ }
            send({ type: 'tool_start', toolCallId: tc.id, toolName: tc.function.name, toolArgs: parsedArgs });

            let result: Record<string, unknown>;
            try {
              const args = JSON.parse(tc.function.arguments || '{}');
              result = await executeTool(tc.function.name, args, ctx);
            } catch (e) {
              result = { _tool: tc.function.name, error: e instanceof Error ? e.message : 'Unknown error' };
            }

            send({ type: 'tool_result', toolCallId: tc.id, toolName: tc.function.name, toolResult: result });

            messages.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: JSON.stringify(result),
            });
          }

          // Continue the loop — OpenAI will process tool results and may call more tools or generate text
        }

        send({ type: 'done' });
      } catch (e) {
        const errMsg = e instanceof Error ? `${e.name}: ${e.message}` : 'Unknown error';
        console.error('[coal-agent] Chat error:', errMsg);
        send({ type: 'error', error: errMsg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
