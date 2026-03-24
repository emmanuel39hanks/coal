import { IS_TESTNET } from './chain';

const DEFAULT_USDC_ADDRESS = IS_TESTNET
  ? '0x036CbD53842c5426634e7929541eC2318f3dCF7e'
  : '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

export const SETTLEMENT_TOKEN = {
  symbol: 'USDC',
  address: DEFAULT_USDC_ADDRESS as `0x${string}`,
  decimals: 6,
  chainId: IS_TESTNET ? 84532 : 8453,
};

export const SUPPORTED_TOKENS = [
  { symbol: 'USDC', name: 'USD Coin', chainId: IS_TESTNET ? 84532 : 8453, address: DEFAULT_USDC_ADDRESS, decimals: 6, logo: '💵' },
  { symbol: 'ETH', name: 'Ethereum', chainId: IS_TESTNET ? 84532 : 8453, address: '0x0000000000000000000000000000000000000000', decimals: 18, logo: '⟠' },
  { symbol: 'USDT', name: 'Tether', chainId: 1, address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6, logo: '💲' },
  { symbol: 'WBTC', name: 'Wrapped Bitcoin', chainId: 1, address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', decimals: 8, logo: '₿' },
  { symbol: 'DAI', name: 'Dai', chainId: 1, address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', decimals: 18, logo: '◈' },
  { symbol: 'USDC (Arbitrum)', name: 'USD Coin', chainId: 42161, address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals: 6, logo: '💵' },
  { symbol: 'ETH (Arbitrum)', name: 'Ethereum', chainId: 42161, address: '0x0000000000000000000000000000000000000000', decimals: 18, logo: '⟠' },
];

export const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum',
  8453: 'Base',
  84532: 'Base Sepolia',
  42161: 'Arbitrum',
  10: 'Optimism',
  137: 'Polygon',
};
