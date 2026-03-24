import { base, baseSepolia } from 'viem/chains';
import { createPublicClient, http } from 'viem';

export const IS_TESTNET = process.env.CHAIN_ENV === 'testnet';
export const CHAIN = IS_TESTNET ? baseSepolia : base;
export const CHAIN_ID = CHAIN.id;

export const RPC_URL = IS_TESTNET
  ? `https://base-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
  : `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;

export const EXPLORER_URL = IS_TESTNET ? 'https://sepolia.basescan.org' : 'https://basescan.org';
const DEFAULT_USDC_ADDRESS = (IS_TESTNET
  ? '0x036CbD53842c5426634e7929541eC2318f3dCF7e'
  : '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913') as `0x${string}`;

export const TOKENS = {
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

export const publicClient = createPublicClient({
  chain: CHAIN,
  transport: http(RPC_URL),
});
