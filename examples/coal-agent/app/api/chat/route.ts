import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { tools } from '@/lib/tools';
import { executeTool } from '@/lib/tool-executor';

interface FunctionToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

const SYSTEM_PROMPT = `You are Coal Agent, an AI commerce assistant powered by Coal and the 0G network.

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

When users ask to discover a merchant or see 0G data, use the discover_merchant_on_0g tool with the appropriate root hash. When they ask about products/memory, use query_merchant_memory. For policy questions, use evaluate_policy.

AUTONOMOUS PAYMENT FLOW:
You have your own wallet with USDC on Base. You can pay for things autonomously — no human clicks needed.

When a user wants to buy something:
1. Check your wallet balance with get_agent_wallet
2. Query memory or discover the merchant to find product details (name, price, image URL)
3. Tell the user what you found and what you're about to buy, including the price
4. Create a checkout using create_checkout with the product amount, name, and productImage URL if available
5. Immediately pay using execute_payment with the sessionId, amount, merchant payout address, and purpose
6. After payment succeeds, verify the receipt using verify_receipt to show the full 0G proof trail (Base TX → 0G Storage → 0G Chain)

For paywalls:
1. Check the paywall with check_paywall
2. If payment required, create a pay intent with create_paywall_pay_intent
3. Pay using execute_payment with the returned sessionId and the merchant payout address
4. After payment, check the paywall again to confirm access is granted

RULES:
- Always check your balance before paying
- Always tell the user what you're paying for and how much BEFORE executing the payment
- If the amount is more than $0.50, ask the user to confirm before paying
- After every payment, verify the receipt to show the 0G proof trail
- The merchant payout address is: 0xc495953de50ac375e3c564f4acd4cc48949576ae
- Maximum $5.00 per transaction (enforced by the wallet)
- Your wallet balance is visible in the header — the user can watch it change in real time

IMPORTANT: When you discover a merchant profile or query memory and see product images, always pass the productImage URL when creating a checkout so the card displays the product image.

Be concise. Show data, not essays. You are an autonomous commerce agent — act decisively.`;

const MAX_TOOL_ROUNDS = 8;

export const maxDuration = 60;

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });
  }

  const { messages: clientMessages } = (await req.json()) as { messages: Array<{ role: string; content: string }> };

  const openai = new OpenAI({ apiKey });
  const model = process.env.OPENAI_MODEL || 'gpt-4o';

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

      try {
        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const completion = await openai.chat.completions.create({
            model,
            messages,
            tools,
            tool_choice: 'auto',
            stream: true,
          });

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
              result = await executeTool(tc.function.name, args);
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
