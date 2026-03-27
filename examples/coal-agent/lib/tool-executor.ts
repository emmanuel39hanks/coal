import * as coal from './coal-api';
import { downloadFromZeroG } from './zero-g';

export async function executeTool(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  switch (name) {
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
      const result = await coal.verifyReceipt(args.checkoutId as string);
      return { _tool: 'verify_receipt', ...result };
    }

    default:
      return { _tool: name, error: `Unknown tool: ${name}` };
  }
}
