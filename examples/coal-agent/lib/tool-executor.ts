import * as coal from './coal-api';
import { downloadFromZeroG } from './zero-g';
import { sendUsdc, getUsdcBalance } from './wallet';

// Per-session wallet ID — set by the chat route before tool execution
let _sessionWalletId: string = '';
let _sessionWalletAddress: string = '';

export function setSessionWallet(walletId: string, address: string) {
  _sessionWalletId = walletId;
  _sessionWalletAddress = address;
}

export async function executeTool(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  switch (name) {
    case 'discover_merchants': {
      const result = await coal.discoverMerchants();
      return { _tool: 'discover_merchants', ...result };
    }

    case 'discover_merchant_on_0g': {
      const result = await downloadFromZeroG(args.rootHash as string);
      return {
        _tool: 'discover_merchant_on_0g',
        label: (args.label as string) || 'Artifact',
        ...result,
      };
    }

    case 'get_merchant_profile': {
      const result = await coal.getMerchantProfile(args.merchantId as string);
      return { _tool: 'get_merchant_profile', ...result };
    }

    case 'query_merchant_memory': {
      const result = await coal.queryMemory(args.query as string);
      return { _tool: 'query_merchant_memory', ...result };
    }

    case 'route_commerce_request': {
      const result = await coal.routeCommerce(args.goal as string);
      return { _tool: 'route_commerce_request', ...result };
    }

    case 'get_recommendations': {
      const result = await coal.getRecommendations(args.goal as string);
      return { _tool: 'get_recommendations', ...result };
    }

    case 'evaluate_policy': {
      const result = await coal.evaluatePolicy(args.scenario as string);
      return { _tool: 'evaluate_policy', ...result };
    }

    case 'check_paywall': {
      const result = await coal.checkPaywallAccess(
        args.paywallId as string,
        { address: args.address as string | undefined, agentId: args.agentId as string | undefined },
      );
      return { _tool: 'check_paywall', ...result };
    }

    case 'create_checkout': {
      const result = await coal.createCheckout({
        amount: args.amount as number,
        currency: (args.currency as string) || 'USDC',
        description: args.description as string | undefined,
        productName: args.productName as string | undefined,
      });
      // Map response fields for the CheckoutCard
      const data = result as Record<string, unknown>;
      return {
        _tool: 'create_checkout',
        checkoutId: data.id || data.checkoutId,
        amount: String(data.amount ?? args.amount),
        currency: (data.currency as string) || 'USDC',
        status: data.status || 'pending',
        paymentUrl: data.url || data.paymentUrl,
        description: data.description || args.description,
        productName: data.productName || args.productName,
        productImage: args.productImage || null,
        expiresAt: data.expiresAt,
      };
    }

    case 'create_paywall_pay_intent': {
      const result = await coal.createPaywallPayIntent(
        args.paywallId as string,
        { agentId: args.agentId as string | undefined },
      );
      return { _tool: 'create_paywall_pay_intent', ...result };
    }

    case 'verify_receipt': {
      // Poll until receipt is confirmed (payment verification takes a few seconds)
      const checkoutId = args.checkoutId as string;
      const maxAttempts = 8;
      const delayMs = 3000;
      for (let i = 0; i < maxAttempts; i++) {
        const result = await coal.verifyReceipt(checkoutId);
        const data = result as Record<string, unknown>;
        if (data.verified || data.status === 'confirmed') {
          return { _tool: 'verify_receipt', ...data };
        }
        // Wait before retrying
        if (i < maxAttempts - 1) {
          await new Promise(r => setTimeout(r, delayMs));
        }
      }
      // Return whatever we have after max attempts
      const final = await coal.verifyReceipt(checkoutId);
      return { _tool: 'verify_receipt', ...final };
    }

    case 'execute_payment': {
      if (!_sessionWalletId) throw new Error('Agent wallet not initialized. Please refresh the page.');

      const sessionId = args.sessionId as string;

      // SAFETY: Verify the session exists BEFORE sending money
      try {
        const statusCheck = await coal.verifyReceipt(sessionId).catch(() => null);
        // If receipt endpoint returns null/error, try a basic status check
        if (!statusCheck) {
          const statusRes = await fetch(`${process.env.COAL_API_URL || 'https://api.usecoal.xyz'}/api/pay/status/${sessionId}`);
          if (!statusRes.ok || statusRes.status === 404) {
            throw new Error(`Session ${sessionId} not found. Do not retry — create a new checkout first.`);
          }
        }
      } catch (checkErr) {
        if ((checkErr as Error).message.includes('not found') || (checkErr as Error).message.includes('404')) {
          throw new Error(`Session ${sessionId} not found. Create a new checkout with create_checkout before paying.`);
        }
      }

      const { txHash, amount, to, from } = await sendUsdc(
        _sessionWalletId,
        args.recipient as string,
        args.amount as number,
      );
      // Confirm with Coal backend
      await coal.confirmPayment(sessionId, txHash, from);
      return {
        _tool: 'execute_payment',
        success: true,
        sessionId,
        txHash,
        amount,
        recipient: to,
        from,
        purpose: args.purpose || 'checkout',
        basescanUrl: `https://basescan.org/tx/${txHash}`,
      };
    }

    case 'get_agent_wallet': {
      if (!_sessionWalletAddress) throw new Error('Agent wallet not initialized');
      const wallet = await getUsdcBalance(_sessionWalletAddress);
      return { _tool: 'get_agent_wallet', ...wallet, network: 'base' };
    }

    case 'fetch_paywall_content': {
      const url = new URL(args.url as string);
      url.searchParams.set('address', args.address as string);
      const res = await fetch(url.toString(), {
        headers: { 'Accept': 'application/json' },
      });
      const data = await res.json().catch(() => ({ error: 'Failed to parse response' }));
      return { _tool: 'fetch_paywall_content', status: res.status, ...data };
    }

    default:
      return { _tool: name, error: `Unknown tool: ${name}` };
  }
}
