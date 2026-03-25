import { ActionProvider, WalletProvider, Network, CreateAction } from '@coinbase/agentkit';
import { z } from 'zod';

const COAL_API_URL = process.env.COAL_API_URL || 'https://api.usecoal.xyz';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const CreateCheckoutSchema = z.object({
  amount: z.number().positive().describe('Payment amount (e.g. 25.00)'),
  currency: z.enum(['USDC', 'MNEE']).default('USDC').describe('Token to accept'),
  description: z.string().optional().describe('What this payment is for'),
  callbackUrl: z.string().url().optional().describe('Webhook URL for payment events'),
});

const GetCheckoutStatusSchema = z.object({
  checkoutId: z.string().describe('The checkout session ID returned from coal_create_checkout'),
});

const VerifyReceiptSchema = z.object({
  checkoutId: z.string().describe('The checkout session ID to verify the receipt for'),
});

const CheckPaywallSchema = z.object({
  paywallId: z.string().describe('The paywall ID to check'),
  walletAddress: z
    .string()
    .optional()
    .describe('Optional wallet address to check payment status for a specific payer'),
});

const PayPaywallSchema = z.object({
  paywallId: z.string().describe('The paywall ID to create a pay intent for'),
  walletAddress: z
    .string()
    .optional()
    .describe('Optional wallet address of the payer'),
  agentId: z
    .string()
    .optional()
    .describe('Optional agent identifier for agent-to-paywall payments'),
});

const QueryMemorySchema = z.object({
  query: z
    .string()
    .min(1)
    .max(1500)
    .describe('Natural language query to ask against the merchant memory'),
});

const EvaluatePolicySchema = z.object({
  scenario: z
    .string()
    .min(1)
    .max(2000)
    .describe('Commerce scenario to evaluate (e.g. "customer requests a refund after 30 days")'),
});

// ---------------------------------------------------------------------------
// Action Provider
// ---------------------------------------------------------------------------

export class CoalCheckoutActionProvider extends ActionProvider<WalletProvider> {
  constructor() {
    super('coal', []);
  }

  // -----------------------------------------------------------------------
  // 1. coal_create_checkout (existing)
  // -----------------------------------------------------------------------

  @CreateAction({
    name: 'coal_create_checkout',
    description: 'Create a Coal payment checkout session. Returns a payment URL to send to the customer.',
    schema: CreateCheckoutSchema,
  })
  async createCheckout(args: z.infer<typeof CreateCheckoutSchema>): Promise<string> {
    const apiKey = process.env.COAL_API_KEY;
    if (!apiKey) throw new Error('COAL_API_KEY environment variable is required');

    const response = await fetch(`${COAL_API_URL}/api/agent/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(args),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(`Coal checkout failed: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return `Checkout created successfully!\nPayment URL: ${data.paymentUrl}\nCheckout ID: ${data.checkoutId}\nAmount: ${data.amount} ${data.currency}\nExpires: ${data.expiresAt}`;
  }

  // -----------------------------------------------------------------------
  // 2. coal_get_checkout_status (existing)
  // -----------------------------------------------------------------------

  @CreateAction({
    name: 'coal_get_checkout_status',
    description: 'Get the status of a Coal payment checkout session.',
    schema: GetCheckoutStatusSchema,
  })
  async getCheckoutStatus(args: z.infer<typeof GetCheckoutStatusSchema>): Promise<string> {
    const apiKey = process.env.COAL_API_KEY;
    if (!apiKey) throw new Error('COAL_API_KEY environment variable is required');

    const response = await fetch(`${COAL_API_URL}/api/agent/checkout/${args.checkoutId}`, {
      headers: { 'x-api-key': apiKey },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(`Failed to get checkout status: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return `Checkout ${data.checkoutId}: ${data.status}\nAmount: ${data.amount} ${data.currency}\nPayment URL: ${data.paymentUrl}`;
  }

  // -----------------------------------------------------------------------
  // 3. coal_verify_receipt
  // -----------------------------------------------------------------------

  @CreateAction({
    name: 'coal_verify_receipt',
    description:
      'Verify a payment receipt and get the full proof trail: payment on Base, receipt on 0G Storage, and anchor on 0G Chain. No API key required — this is a public verification endpoint.',
    schema: VerifyReceiptSchema,
  })
  async verifyReceipt(args: z.infer<typeof VerifyReceiptSchema>): Promise<string> {
    const response = await fetch(`${COAL_API_URL}/api/receipts/${args.checkoutId}`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(`Receipt verification failed: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();

    if (!data.verified) {
      return `Receipt ${data.checkoutId}: NOT VERIFIED\nStatus: ${data.status}\nThe payment has not been confirmed yet.`;
    }

    const lines: string[] = [
      `Receipt ${data.checkoutId}: VERIFIED`,
      `Merchant: ${data.merchant?.name ?? 'N/A'}`,
      '',
      '--- Payment ---',
      `Amount: ${data.payment.amount} ${data.payment.currency}`,
      `Description: ${data.payment.description ?? 'N/A'}`,
      `Tx Hash: ${data.payment.txHash}`,
      `Explorer: ${data.payment.explorerUrl}`,
      `Paid At: ${data.payment.paidAt}`,
    ];

    if (data.proofTrail?.storage) {
      const s = data.proofTrail.storage;
      lines.push(
        '',
        '--- 0G Storage ---',
        `Storage URI: ${s.storageUri}`,
        `Storage Root: ${s.storageRoot}`,
        `Payload Hash: ${s.payloadHash}`,
        `Explorer: ${s.explorerUrl ?? 'N/A'}`,
        `Published At: ${s.publishedAt}`,
      );
    }

    if (data.proofTrail?.chain) {
      const c = data.proofTrail.chain;
      lines.push(
        '',
        '--- 0G Chain Anchor ---',
        `Anchor Tx: ${c.anchorTxHash}`,
        `Contract: ${c.anchorContract}`,
        `Chain ID: ${c.anchorChainId}`,
        `Payload Hash: ${c.payloadHash}`,
        `Explorer: ${c.explorerUrl}`,
        `Anchored At: ${c.anchoredAt}`,
      );
    }

    return lines.join('\n');
  }

  // -----------------------------------------------------------------------
  // 4. coal_check_paywall
  // -----------------------------------------------------------------------

  @CreateAction({
    name: 'coal_check_paywall',
    description:
      'Check a paywall\'s payment status. Supports x402: if payment is required the response includes structured payment requirements. No API key required — this is a public endpoint.',
    schema: CheckPaywallSchema,
  })
  async checkPaywall(args: z.infer<typeof CheckPaywallSchema>): Promise<string> {
    const url = new URL(`${COAL_API_URL}/api/paywalls/${args.paywallId}/verify`);
    if (args.walletAddress) {
      url.searchParams.set('address', args.walletAddress);
    }

    const response = await fetch(url.toString());

    if (response.status === 402) {
      // x402 payment required — extract requirements from header
      const x402Header = response.headers.get('X-PAYMENT');
      const body = await response.json().catch(() => ({}));

      const lines: string[] = [
        `Paywall ${args.paywallId}: PAYMENT REQUIRED (402)`,
      ];

      if (x402Header) {
        try {
          const requirements = JSON.parse(
            Buffer.from(x402Header, 'base64').toString('utf-8'),
          );
          lines.push(
            '',
            '--- Payment Requirements (x402) ---',
            `Amount: ${requirements.maxAmountRequired ?? 'N/A'}`,
            `Currency: ${requirements.currency ?? requirements.asset ?? 'N/A'}`,
            `Network: ${requirements.network ?? 'N/A'}`,
            `Receiver: ${requirements.receiver ?? requirements.payTo ?? 'N/A'}`,
          );
          if (requirements.description) {
            lines.push(`Description: ${requirements.description}`);
          }
        } catch {
          lines.push(`\nX-PAYMENT header (raw): ${x402Header}`);
        }
      }

      if (body.paymentUrl) {
        lines.push(`\nPayment URL: ${body.paymentUrl}`);
      }

      return lines.join('\n');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(`Paywall check failed: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return `Paywall ${args.paywallId}: ACCESS GRANTED\nPaid: ${data.paid ?? true}\n${JSON.stringify(data, null, 2)}`;
  }

  // -----------------------------------------------------------------------
  // 5. coal_pay_paywall
  // -----------------------------------------------------------------------

  @CreateAction({
    name: 'coal_pay_paywall',
    description:
      'Create a pay intent for a paywall (agent-to-paywall payment flow). Returns a checkout session with a payment URL and a verification URL. Requires a COAL_API_KEY.',
    schema: PayPaywallSchema,
  })
  async payPaywall(args: z.infer<typeof PayPaywallSchema>): Promise<string> {
    const apiKey = process.env.COAL_API_KEY;
    if (!apiKey) throw new Error('COAL_API_KEY environment variable is required');

    const body: Record<string, unknown> = {};
    if (args.walletAddress || args.agentId) {
      body.subject = {
        ...(args.walletAddress ? { walletAddress: args.walletAddress } : {}),
        ...(args.agentId ? { agentId: args.agentId } : {}),
      };
    }

    const response = await fetch(
      `${COAL_API_URL}/api/agent/paywalls/${args.paywallId}/pay-intent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(`Pay intent failed: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return [
      'Pay intent created successfully!',
      `Checkout ID: ${data.checkoutId}`,
      `Paywall ID: ${data.paywallId}`,
      `Amount: ${data.amount} ${data.currency}`,
      `Status: ${data.status}`,
      `Payment URL: ${data.paymentUrl}`,
      `Verify URL: ${data.verifyUrl}`,
      `Expires: ${data.expiresAt}`,
    ].join('\n');
  }

  // -----------------------------------------------------------------------
  // 6. coal_query_memory
  // -----------------------------------------------------------------------

  @CreateAction({
    name: 'coal_query_memory',
    description:
      'Query a merchant\'s memory via 0G AI. Ask natural language questions about the merchant\'s products, paywalls, settings, and more. Uses 0G Sealed Inference when available. Requires a COAL_API_KEY.',
    schema: QueryMemorySchema,
  })
  async queryMemory(args: z.infer<typeof QueryMemorySchema>): Promise<string> {
    const apiKey = process.env.COAL_API_KEY;
    if (!apiKey) throw new Error('COAL_API_KEY environment variable is required');

    const response = await fetch(`${COAL_API_URL}/api/agent/memory/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({ query: args.query }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(`Memory query failed: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const r = data.response;

    const lines: string[] = [
      '--- Memory Query Result ---',
      `Query: ${data.query}`,
      `Answer: ${r.answer}`,
    ];

    if (r.citations?.length) {
      lines.push(`\nCitations: ${r.citations.join(', ')}`);
    }

    if (r.recommendedActions?.length) {
      lines.push('\nRecommended Actions:');
      r.recommendedActions.forEach((action: string) => lines.push(`  - ${action}`));
    }

    lines.push(`\nSource: ${data.source}`);

    if (data.zeroG) {
      lines.push(
        '',
        '--- 0G Info ---',
        `Memory Source: ${data.zeroG.memorySource}`,
        `Sealed Inference: ${data.zeroG.sealedInference}`,
      );
      if (data.zeroG.storageUri) {
        lines.push(`Storage URI: ${data.zeroG.storageUri}`);
      }
    }

    return lines.join('\n');
  }

  // -----------------------------------------------------------------------
  // 7. coal_evaluate_policy
  // -----------------------------------------------------------------------

  @CreateAction({
    name: 'coal_evaluate_policy',
    description:
      'Evaluate a commerce policy scenario against a merchant\'s configuration using 0G AI. Returns an allow/deny/review decision with rationale. Requires a COAL_API_KEY.',
    schema: EvaluatePolicySchema,
  })
  async evaluatePolicy(args: z.infer<typeof EvaluatePolicySchema>): Promise<string> {
    const apiKey = process.env.COAL_API_KEY;
    if (!apiKey) throw new Error('COAL_API_KEY environment variable is required');

    const response = await fetch(`${COAL_API_URL}/api/agent/commerce/policy-eval`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({ scenario: args.scenario }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(`Policy evaluation failed: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const e = data.evaluation;

    const lines: string[] = [
      '--- Policy Evaluation ---',
      `Scenario: ${data.scenario}`,
      `Decision: ${e.decision.toUpperCase()}`,
      `Rationale: ${e.rationale}`,
    ];

    if (e.citations?.length) {
      lines.push(`\nCitations: ${e.citations.join(', ')}`);
    }

    if (e.nextActions?.length) {
      lines.push('\nNext Actions:');
      e.nextActions.forEach((action: string) => lines.push(`  - ${action}`));
    }

    lines.push(`\nSource: ${data.source}`);

    if (data.zeroG) {
      lines.push(
        '',
        '--- 0G Info ---',
        `Memory Source: ${data.zeroG.memorySource}`,
      );
      if (data.zeroG.storageUri) {
        lines.push(`Storage URI: ${data.zeroG.storageUri}`);
      }
    }

    return lines.join('\n');
  }

  supportsNetwork = (_network: Network) => true;
}

export const coalCheckoutActionProvider = () => new CoalCheckoutActionProvider();
