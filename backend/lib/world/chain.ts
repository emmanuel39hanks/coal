/**
 * World Chain receipt anchor.
 *
 * Mirrors `lib/0g/chain.ts` but writes to the CoalReceiptAnchor contract
 * deployed on World Chain (chain 480) or World Sepolia (4801). The
 * contract bytecode is byte-identical to the 0G deploy; on non-0G
 * chains the DASigners precompile call inside `_currentDAEpoch()`
 * falls through the try/catch and the emitted event carries
 * `daEpoch = 0`. That is the expected, documented behavior.
 *
 * 0G remains the canonical anchor for Coal receipts. This World Chain
 * anchor is additive — it only fires for sessions whose settlementChain
 * is 'worldchain', and it does not replace the 0G path.
 *
 * Operator key is reused from ZERO_G_CHAIN_PRIVATE_KEY. Same wallet,
 * same address on every EVM chain — simpler ops, same security
 * posture (nonces are chain-scoped, no cross-chain replay).
 */

import { createWalletClient, http, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { logger } from '@/lib/logger';
import { getChainByKey, getPublicClient, WORLD_CHAIN_ENABLED } from '@/lib/chains';

/**
 * Same ABI as backend/lib/0g/chain.ts — the contract is the same source.
 * Keep these in sync if the contract ever adds functions.
 */
export const worldReceiptAnchorAbi = parseAbi([
    'function anchorReceipt(bytes32 receiptHash, bytes32 artifactRoot, bytes32 subjectHash)',
    'function anchorEntitlement(bytes32 entitlementHash, bytes32 artifactRoot, bytes32 subjectHash)',
    'function anchorProfile(bytes32 profileHash, bytes32 artifactRoot, bytes32 merchantHash)',
]);

const OPERATOR_KEY = (process.env.ZERO_G_CHAIN_PRIVATE_KEY || '') as `0x${string}` | '';
const CONFIRMATION_TIMEOUT_MS = 45_000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
        promise.then(
            (value) => { clearTimeout(timer); resolve(value); },
            (error) => { clearTimeout(timer); reject(error); },
        );
    });
}

export function isWorldChainAnchorConfigured(): boolean {
    if (!WORLD_CHAIN_ENABLED) return false;
    if (!OPERATOR_KEY) return false;
    const cfg = getChainByKey('worldchain');
    return Boolean(cfg.receiptAnchor);
}

export interface WorldChainAnchorResult {
    kind: 'receipt';
    payloadHash: `0x${string}`;
    artifactRoot: `0x${string}`;
    subjectHash: `0x${string}`;
    anchorTxHash: `0x${string}`;
    anchorContract: `0x${string}`;
    anchorChainId: number;
    anchoredAt: string;
}

export async function anchorReceiptOnWorldChain(
    payloadHash: `0x${string}`,
    artifactRoot: `0x${string}`,
    subjectHash: `0x${string}`,
): Promise<WorldChainAnchorResult> {
    if (!isWorldChainAnchorConfigured()) {
        throw new Error(
            'World Chain anchor is not configured — set WORLD_CHAIN_ENABLED, WORLD_CHAIN_RECEIPT_ANCHOR_ADDRESS (or the sepolia equivalent), and ZERO_G_CHAIN_PRIVATE_KEY',
        );
    }

    const cfg = getChainByKey('worldchain');
    const publicClient = getPublicClient('worldchain');
    const walletClient = createWalletClient({
        chain: cfg.chain,
        transport: http(cfg.rpcUrl),
        account: privateKeyToAccount(OPERATOR_KEY as `0x${string}`),
    });

    const hash = await walletClient.writeContract({
        address: cfg.receiptAnchor as `0x${string}`,
        abi: worldReceiptAnchorAbi,
        functionName: 'anchorReceipt',
        args: [payloadHash, artifactRoot, subjectHash],
    });

    await withTimeout(
        publicClient.waitForTransactionReceipt({ hash }),
        CONFIRMATION_TIMEOUT_MS,
        'World Chain receipt anchor confirmation',
    );

    logger.info(
        {
            anchorTxHash: hash,
            anchorContract: cfg.receiptAnchor,
            chainId: cfg.chainId,
            payloadHash,
        },
        'Anchored receipt on World Chain',
    );

    return {
        kind: 'receipt',
        payloadHash,
        artifactRoot,
        subjectHash,
        anchorTxHash: hash,
        anchorContract: cfg.receiptAnchor as `0x${string}`,
        anchorChainId: cfg.chainId,
        anchoredAt: new Date().toISOString(),
    };
}

export async function checkWorldChainHealth() {
    const cfg = getChainByKey('worldchain');
    const configured = isWorldChainAnchorConfigured();
    if (!configured) {
        return {
            enabled: WORLD_CHAIN_ENABLED,
            configured: false,
            chainId: cfg.chainId,
            receiptAnchorAddress: cfg.receiptAnchor,
            reason: WORLD_CHAIN_ENABLED
                ? 'WORLD_CHAIN_ENABLED=true but anchor address or operator key is missing'
                : 'WORLD_CHAIN_ENABLED is not set',
        };
    }

    const startedAt = Date.now();
    const publicClient = getPublicClient('worldchain');

    const [blockNumber, anchorBytecode] = await Promise.all([
        publicClient.getBlockNumber(),
        publicClient.getBytecode({ address: cfg.receiptAnchor as `0x${string}` }),
    ]);

    return {
        enabled: true,
        configured: true,
        chainId: cfg.chainId,
        latestBlock: blockNumber.toString(),
        latencyMs: Date.now() - startedAt,
        receiptAnchorAddress: cfg.receiptAnchor,
        receiptAnchorDeployed: Boolean(anchorBytecode && anchorBytecode !== '0x'),
        receiptAnchorContractUrl: `${cfg.explorerUrl}/address/${cfg.receiptAnchor}`,
        explorerBaseUrl: cfg.explorerUrl,
    };
}
