import { base, baseSepolia } from 'viem/chains';
import { createPublicClient, http, fallback } from 'viem';

export const IS_TESTNET = process.env.CHAIN_ENV === 'testnet';
export const CHAIN = IS_TESTNET ? baseSepolia : base;
export const CHAIN_ID = CHAIN.id;

const ALCHEMY_RPC = process.env.ALCHEMY_API_KEY
  ? (IS_TESTNET
      ? `https://base-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
      : `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`)
  : null;

const SECONDARY_RPC = process.env.BASE_RPC_FALLBACK_URL || null;

const PUBLIC_RPC = IS_TESTNET ? 'https://sepolia.base.org' : 'https://mainnet.base.org';

// Build transport list in priority order. Always include the public Base
// RPC last so calls succeed even if both Alchemy and the optional
// secondary provider are unavailable or rate-limited.
const transports = [
  ...(ALCHEMY_RPC ? [http(ALCHEMY_RPC)] : []),
  ...(SECONDARY_RPC ? [http(SECONDARY_RPC)] : []),
  http(PUBLIC_RPC),
];

// Legacy export: still used by code that builds bespoke wallet clients
// with a single URL. New consumers should prefer `walletTransport`.
export const RPC_URL = ALCHEMY_RPC || SECONDARY_RPC || PUBLIC_RPC;

// Shared transport with automatic fallback + retry. Use this for both
// read and write clients so a single provider outage doesn't take down
// the payment path.
export const walletTransport = fallback(transports, { retryCount: 2 });

export const EXPLORER_URL = IS_TESTNET ? 'https://sepolia.basescan.org' : 'https://basescan.org';
const DEFAULT_USDC_ADDRESS = (IS_TESTNET
  ? '0x036CbD53842c5426634e7929541eC2318f3dCF7e'
  : '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913') as `0x${string}`;

export const TOKENS = {
  ETH: {
    address: '0x0000000000000000000000000000000000000000' as `0x${string}`,
    decimals: 18,
    symbol: 'ETH',
    name: 'Ethereum',
  },
  USDC: {
    address: DEFAULT_USDC_ADDRESS,
    decimals: 6,
    symbol: 'USDC',
    name: 'USD Coin',
  },
  CUSTOM: {
    address: (process.env.SETTLEMENT_TOKEN_ADDRESS || process.env.MNEE_BASE_ADDRESS || null) as `0x${string}` | null,
    decimals: parseInt(process.env.SETTLEMENT_TOKEN_DECIMALS || process.env.MNEE_BASE_DECIMALS || '6'),
    symbol:
      process.env.SETTLEMENT_TOKEN_SYMBOL ||
      (process.env.MNEE_BASE_ADDRESS && !process.env.SETTLEMENT_TOKEN_ADDRESS ? 'MNEE' : process.env.SETTLEMENT_TOKEN_ADDRESS ? 'TOKEN' : 'USDC'),
    name:
      process.env.SETTLEMENT_TOKEN_NAME ||
      process.env.SETTLEMENT_TOKEN_SYMBOL ||
      (process.env.MNEE_BASE_ADDRESS && !process.env.SETTLEMENT_TOKEN_ADDRESS ? 'MNEE' : process.env.SETTLEMENT_TOKEN_ADDRESS ? 'Configured Token' : 'USD Coin'),
  },
} as const;

// Returns the configured settlement token if present, else USDC.
export function getSettlementToken() {
  return TOKENS.CUSTOM.address ? TOKENS.CUSTOM as { address: `0x${string}`; decimals: number; symbol: string; name: string } : TOKENS.USDC;
}

export function getNativeFundingToken() {
  return TOKENS.ETH;
}

export const publicClient = createPublicClient({
  chain: CHAIN,
  transport: walletTransport,
});
