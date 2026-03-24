import { ActionProvider, WalletProvider, Network, CreateAction } from '@coinbase/agentkit';
import { z } from 'zod';

const COAL_API_URL = process.env.COAL_API_URL || 'https://api.usecoal.xyz';

const CreateCheckoutSchema = z.object({
  amount: z.number().positive().describe('Payment amount (e.g. 25.00)'),
  currency: z.enum(['USDC', 'MNEE']).default('USDC').describe('Token to accept'),
  description: z.string().optional().describe('What this payment is for'),
  callbackUrl: z.string().url().optional().describe('Webhook URL for payment events'),
});

const GetCheckoutStatusSchema = z.object({
  checkoutId: z.string().describe('The checkout session ID returned from coal_create_checkout'),
});

export class CoalCheckoutActionProvider extends ActionProvider<WalletProvider> {
  constructor() {
    super('coal', []);
  }

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

  supportsNetwork = (_network: Network) => true;
}

export const coalCheckoutActionProvider = () => new CoalCheckoutActionProvider();
