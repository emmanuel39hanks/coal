'use client';

import {
  config as lifiConfig,
  convertQuoteToRoute,
  createConfig,
  EVM,
  executeRoute,
  getQuote,
  getRoutes,
  type QuoteRequestToAmount,
  type RouteExtended,
  type RoutesRequest,
} from '@lifi/sdk';
import { createWalletClient, custom, parseUnits } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { IS_TESTNET, getNativeFundingToken, getSettlementToken } from '@/lib/chain';

createConfig({
  integrator: 'coal-payments',
});

export interface TokenOption {
  symbol: string;
  name: string;
  chainId: number;
  address: string;
  decimals: number;
  icon: string;
}

function getTokenIcon(symbol: string) {
  switch (symbol.toUpperCase()) {
    case 'ETH':
      return 'cryptocurrency-color:eth';
    case 'USDT':
      return 'cryptocurrency-color:usdt';
    case 'DAI':
      return 'cryptocurrency-color:dai';
    case 'WBTC':
      return 'cryptocurrency-color:wbtc';
    case 'USDC':
    default:
      return 'cryptocurrency-color:usdc';
  }
}

const settlementToken = getSettlementToken();
const settlementChain = IS_TESTNET ? baseSepolia : base;
const settlementChainId = settlementChain.id;
const nativeFundingToken = getNativeFundingToken();

export const SETTLEMENT_TOKEN_OPTION: TokenOption = {
  address: settlementToken.address,
  chainId: settlementChainId,
  decimals: settlementToken.decimals,
  symbol: settlementToken.symbol,
  name: settlementToken.name,
  icon: getTokenIcon(settlementToken.symbol),
};

export const USDC_BASE: TokenOption = SETTLEMENT_TOKEN_OPTION;

export const ETH_BASE: TokenOption = {
  address: nativeFundingToken.address,
  chainId: settlementChainId,
  decimals: nativeFundingToken.decimals,
  symbol: nativeFundingToken.symbol,
  name: `${nativeFundingToken.name} (${IS_TESTNET ? 'Base Sepolia' : 'Base'})`,
  icon: getTokenIcon(nativeFundingToken.symbol),
};

export const AUDITED_ROUTE_OPTIONS: TokenOption[] = [
  { symbol: 'USDC', name: 'USD Coin', chainId: 8453, address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6, icon: 'cryptocurrency-color:usdc' },
  { symbol: 'ETH', name: 'Ethereum (Base)', chainId: 8453, address: '0x0000000000000000000000000000000000000000', decimals: 18, icon: 'cryptocurrency-color:eth' },
  { symbol: 'ETH', name: 'Ethereum', chainId: 1, address: '0x0000000000000000000000000000000000000000', decimals: 18, icon: 'cryptocurrency-color:eth' },
  { symbol: 'USDC', name: 'USD Coin (Ethereum)', chainId: 1, address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6, icon: 'cryptocurrency-color:usdc' },
  { symbol: 'USDT', name: 'Tether USD', chainId: 1, address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6, icon: 'cryptocurrency-color:usdt' },
  { symbol: 'DAI', name: 'Dai Stablecoin', chainId: 1, address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', decimals: 18, icon: 'cryptocurrency-color:dai' },
  { symbol: 'WBTC', name: 'Wrapped Bitcoin', chainId: 1, address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', decimals: 8, icon: 'cryptocurrency-color:wbtc' },
  { symbol: 'ETH', name: 'Ethereum (Arbitrum)', chainId: 42161, address: '0x0000000000000000000000000000000000000000', decimals: 18, icon: 'cryptocurrency-color:eth' },
  { symbol: 'USDC', name: 'USD Coin (Arbitrum)', chainId: 42161, address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals: 6, icon: 'cryptocurrency-color:usdc' },
];

function dedupeTokenOptions(options: TokenOption[]) {
  const seen = new Set<string>();
  return options.filter((token) => {
    const key = `${token.chainId}:${token.address.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export const TOKEN_OPTIONS: TokenOption[] = IS_TESTNET
  ? [SETTLEMENT_TOKEN_OPTION]
  : dedupeTokenOptions([
      SETTLEMENT_TOKEN_OPTION,
      ...AUDITED_ROUTE_OPTIONS,
    ]);

export async function getLifiQuote(params: {
  fromToken: TokenOption;
  toAmountUSDC: number;
  fromAddress: string;
  toAddress: string;
}): Promise<{ fromAmount: string; estimatedTime: number; fees: string } | null> {
  try {
    if (IS_TESTNET) {
      return null;
    }

    const estimatedFromAmount = BigInt(
      Math.floor(params.toAmountUSDC * 10 ** params.fromToken.decimals)
    ).toString();

    const routeRequest: RoutesRequest = {
      fromChainId: params.fromToken.chainId,
      toChainId: SETTLEMENT_TOKEN_OPTION.chainId,
      fromTokenAddress: params.fromToken.address,
      toTokenAddress: SETTLEMENT_TOKEN_OPTION.address,
      fromAmount: estimatedFromAmount,
      fromAddress: params.fromAddress,
      toAddress: params.toAddress,
      options: { slippage: 0.005 },
    };

    const result = await getRoutes(routeRequest);
    if (!result.routes.length) return null;

    const best = result.routes[0];
    return {
      fromAmount: best.fromAmount,
      estimatedTime: best.steps.reduce(
        (t, s) => t + (s.estimate?.executionDuration ?? 30),
        0
      ),
      fees: best.gasCostUSD ?? '~$0.50',
    };
  } catch {
    return null;
  }
}

export async function getSettlementExecutionQuote(params: {
  fromAddress: string;
  toAddress: string;
  settlementAmount: string;
}) {
  if (IS_TESTNET) {
    throw new Error('Live LiFi route execution is not enabled on testnet.');
  }

  const request: QuoteRequestToAmount = {
    fromChain: settlementChainId,
    toChain: settlementChainId,
    fromToken: ETH_BASE.address,
    toToken: SETTLEMENT_TOKEN_OPTION.address,
    toAmount: parseUnits(params.settlementAmount, SETTLEMENT_TOKEN_OPTION.decimals).toString(),
    fromAddress: params.fromAddress,
    toAddress: params.toAddress,
    integrator: 'coal-payments',
    slippage: 0.005,
  };

  return getQuote(request);
}

export async function executeSettlementRoute(params: {
  quote: any;
  wallet: {
    address: string;
    getEthereumProvider: () => Promise<any>;
  };
  sourceChainId?: number;
}): Promise<RouteExtended> {
  const provider = await params.wallet.getEthereumProvider();
  const sourceChain = params.sourceChainId
    ? { id: params.sourceChainId } as any
    : settlementChain;
  const walletClient = createWalletClient({
    account: params.wallet.address as `0x${string}`,
    chain: sourceChain,
    transport: custom(provider),
  });

  lifiConfig.setProviders([
    EVM({
      getWalletClient: async () => walletClient,
    }),
  ]);

  // If quote has steps, it's already a route (from getRoutes). Otherwise convert from getQuote.
  const route = params.quote.steps
    ? (params.quote as RouteExtended)
    : convertQuoteToRoute(params.quote);
  return executeRoute(route);
}
