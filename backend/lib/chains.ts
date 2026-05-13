/**
 * Multi-chain settlement registry.
 *
 * Coal today settles USDC on Base. World-3 adds World Chain as a second
 * option. This module centralizes the per-chain config so the payment
 * verification cron, receipt builder, and receipt anchor paths can look
 * up the right publicClient / USDC address / explorer URL by a key.
 *
 * The single global CHAIN_ENV=testnet flips both chains to their Sepolia
 * equivalents. Prod uses mainnet for both.
 *
 * Note: the legacy `@/lib/chain` module remains in use — it still drives
 * the Base-only flows (commerce-payments, tokens, older endpoints). Do
 * not delete it; this module lives alongside.
 */

import { base, baseSepolia, worldchain, worldchainSepolia } from 'viem/chains';
import { createPublicClient, http, fallback, type Chain, type PublicClient, type Transport } from 'viem';

export type SupportedChainKey = 'base' | 'worldchain';

export interface SupportedChainConfig {
    key: SupportedChainKey;
    chain: Chain;
    chainId: number;
    displayName: string;
    rpcUrl: string;
    explorerUrl: string;
    usdc: {
        address: `0x${string}`;
        decimals: number;
        symbol: 'USDC';
        name: string;
    };
    /**
     * Address of the CoalReceiptAnchor deployed on this chain, or null
     * if no settlement-chain anchor exists for this chain.
     *
     * Base intentionally stays null — receipts anchor on 0G, not Base.
     * World Chain gets its own anchor so the full proof trail (tx →
     * storage → anchor) stays reachable without leaving Worldscan.
     */
    receiptAnchor: `0x${string}` | null;
    /**
     * World Chain subsidizes gas for World ID-verified humans. Used
     * by the checkout UI to badge the option.
     */
    gasSubsidizedForVerifiedHumans: boolean;
}

const IS_TESTNET = process.env.CHAIN_ENV === 'testnet';

const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY || '';

function baseRpc(): string {
    if (!ALCHEMY_KEY) {
        return IS_TESTNET ? 'https://sepolia.base.org' : 'https://mainnet.base.org';
    }
    return IS_TESTNET
        ? `https://base-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`
        : `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`;
}

function baseTransport(): Transport {
    const primary = baseRpc();
    const secondary = process.env.BASE_RPC_FALLBACK_URL;
    const publicRpc = IS_TESTNET ? 'https://sepolia.base.org' : 'https://mainnet.base.org';
    const transports = [http(primary)];
    if (secondary && secondary !== primary) transports.push(http(secondary));
    if (publicRpc !== primary && publicRpc !== secondary) transports.push(http(publicRpc));
    return fallback(transports, { retryCount: 2 });
}

function worldRpc(): string {
    if (IS_TESTNET) {
        return (
            process.env.WORLD_CHAIN_SEPOLIA_RPC_URL ||
            `https://worldchain-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`
        );
    }
    return (
        process.env.WORLD_CHAIN_RPC_URL ||
        `https://worldchain-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`
    );
}

function worldReceiptAnchor(): `0x${string}` | null {
    const raw = IS_TESTNET
        ? process.env.WORLD_CHAIN_SEPOLIA_RECEIPT_ANCHOR_ADDRESS
        : process.env.WORLD_CHAIN_RECEIPT_ANCHOR_ADDRESS;
    if (!raw) return null;
    const trimmed = raw.trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) return null;
    return trimmed as `0x${string}`;
}

export const CHAINS: Record<SupportedChainKey, SupportedChainConfig> = {
    base: {
        key: 'base',
        chain: IS_TESTNET ? baseSepolia : base,
        chainId: IS_TESTNET ? 84532 : 8453,
        displayName: IS_TESTNET ? 'Base Sepolia' : 'Base',
        rpcUrl: baseRpc(),
        explorerUrl: IS_TESTNET ? 'https://sepolia.basescan.org' : 'https://basescan.org',
        usdc: {
            address: (IS_TESTNET
                ? '0x036CbD53842c5426634e7929541eC2318f3dCF7e'
                : '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913') as `0x${string}`,
            decimals: 6,
            symbol: 'USDC',
            name: 'USD Coin',
        },
        receiptAnchor: null,
        gasSubsidizedForVerifiedHumans: false,
    },
    worldchain: {
        key: 'worldchain',
        chain: IS_TESTNET ? worldchainSepolia : worldchain,
        chainId: IS_TESTNET ? 4801 : 480,
        displayName: IS_TESTNET ? 'World Chain Sepolia' : 'World Chain',
        rpcUrl: worldRpc(),
        explorerUrl: IS_TESTNET
            ? (process.env.WORLD_CHAIN_SEPOLIA_EXPLORER_URL || 'https://sepolia.worldscan.org')
            : (process.env.WORLD_CHAIN_EXPLORER_URL || 'https://worldscan.org'),
        usdc: {
            address: (IS_TESTNET
                ? '0x66145f38cBAC35Ca6F1Dfb4914dF98F1614aeA88'
                : '0x79a02482a880bce3f13e09da970dc34db4cd24d1') as `0x${string}`,
            decimals: 6,
            symbol: 'USDC',
            name: 'USD Coin',
        },
        receiptAnchor: worldReceiptAnchor(),
        gasSubsidizedForVerifiedHumans: true,
    },
};

const publicClients = new Map<SupportedChainKey, PublicClient>();

export function getPublicClient(key: SupportedChainKey): PublicClient {
    let client = publicClients.get(key);
    if (!client) {
        const cfg = CHAINS[key];
        const transport = key === 'base' ? baseTransport() : http(cfg.rpcUrl);
        client = createPublicClient({ chain: cfg.chain, transport });
        publicClients.set(key, client);
    }
    return client;
}

export function getChainByKey(key: SupportedChainKey): SupportedChainConfig {
    return CHAINS[key];
}

export function getChainByChainId(chainId: number): SupportedChainConfig | null {
    for (const cfg of Object.values(CHAINS)) {
        if (cfg.chainId === chainId) return cfg;
    }
    return null;
}

export function listSupportedChains(): SupportedChainConfig[] {
    return Object.values(CHAINS);
}

export function isSupportedChainKey(value: unknown): value is SupportedChainKey {
    return value === 'base' || value === 'worldchain';
}

/**
 * Coerce a user-supplied value into a SupportedChainKey, falling back
 * to 'base' for unknown / missing values. Used at session-creation
 * time so a malformed client request never takes down the checkout.
 */
export function resolveChainKey(value: unknown): SupportedChainKey {
    return isSupportedChainKey(value) ? value : 'base';
}

/**
 * Default settlement chain when the caller doesn't specify one.
 * Set DEFAULT_SETTLEMENT_CHAIN=worldchain on the Mini App backend to
 * flip the default. Preserves existing behavior by default.
 */
export function getDefaultChainKey(): SupportedChainKey {
    return process.env.DEFAULT_SETTLEMENT_CHAIN === 'worldchain' ? 'worldchain' : 'base';
}

export const WORLD_CHAIN_ENABLED = process.env.WORLD_CHAIN_ENABLED === 'true';
