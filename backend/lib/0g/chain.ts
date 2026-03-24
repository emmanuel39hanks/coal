import { createPublicClient, createWalletClient, defineChain, formatEther, http, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { zeroGLogger } from '@/lib/logger';
import { isZeroGChainWriteConfigured, zeroGEnv } from '@/lib/0g/env';
import type { ZeroGChainAnchorResult } from '@/lib/0g/types';

export const ZERO_G_DA_SIGNERS_PRECOMPILE = '0x0000000000000000000000000000000000001000' as const;
export const ZERO_G_WRAPPED_0G_BASE_PRECOMPILE = '0x0000000000000000000000000000000000001002' as const;

export const zeroGReceiptAnchorAbi = parseAbi([
    'function anchorReceipt(bytes32 receiptHash, bytes32 artifactRoot, bytes32 subjectHash)',
    'function anchorEntitlement(bytes32 entitlementHash, bytes32 artifactRoot, bytes32 subjectHash)',
    'function anchorProfile(bytes32 profileHash, bytes32 artifactRoot, bytes32 merchantHash)',
]);

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
        promise.then(
            (value) => {
                clearTimeout(timer);
                resolve(value);
            },
            (error) => {
                clearTimeout(timer);
                reject(error);
            },
        );
    });
}

const zeroGChain = defineChain({
    id: zeroGEnv.chainId,
    name: zeroGEnv.chainId === 16661 ? '0G Mainnet' : '0G Chain',
    nativeCurrency: {
        name: '0G',
        symbol: '0G',
        decimals: 18,
    },
    rpcUrls: {
        default: {
            http: [zeroGEnv.chainRpcUrl],
        },
    },
    blockExplorers: {
        default: {
            name: 'ChainScan',
            url: zeroGEnv.chainScanBaseUrl,
        },
    },
});

export function getZeroGPublicClient() {
    return createPublicClient({
        chain: zeroGChain,
        transport: http(zeroGEnv.chainRpcUrl),
    });
}

export function getZeroGWalletClient() {
    if (!isZeroGChainWriteConfigured()) {
        throw new Error('0G chain writes require ZERO_G_CHAIN_PRIVATE_KEY and ZERO_G_RECEIPT_ANCHOR_ADDRESS');
    }

    return createWalletClient({
        chain: zeroGChain,
        transport: http(zeroGEnv.chainRpcUrl),
        account: privateKeyToAccount(zeroGEnv.chainPrivateKey as `0x${string}`),
    });
}

async function anchor(
    kind: ZeroGChainAnchorResult['kind'],
    functionName: 'anchorReceipt' | 'anchorEntitlement' | 'anchorProfile',
    payloadHash: `0x${string}`,
    artifactRoot: `0x${string}`,
    subjectHash: `0x${string}`,
) {
    const client = getZeroGWalletClient();
    const publicClient = getZeroGPublicClient();
    const hash = await client.writeContract({
        address: zeroGEnv.receiptAnchorAddress as `0x${string}`,
        abi: zeroGReceiptAnchorAbi,
        functionName,
        args: [payloadHash, artifactRoot, subjectHash],
    });

    await withTimeout(
        publicClient.waitForTransactionReceipt({ hash }),
        45_000,
        `0G ${kind} anchor confirmation`,
    );

    zeroGLogger.info(
        {
            kind,
            anchorTxHash: hash,
            anchorContract: zeroGEnv.receiptAnchorAddress,
            payloadHash,
            artifactRoot,
            subjectHash,
        },
        'Anchored 0G artifact hash on-chain',
    );

    return {
        kind,
        payloadHash,
        artifactRoot,
        subjectHash,
        anchorTxHash: hash,
        anchorContract: zeroGEnv.receiptAnchorAddress as `0x${string}`,
        anchorChainId: zeroGEnv.chainId,
        anchoredAt: new Date().toISOString(),
    } satisfies ZeroGChainAnchorResult;
}

export async function anchorReceipt(
    payloadHash: `0x${string}`,
    artifactRoot: `0x${string}`,
    subjectHash: `0x${string}`,
) {
    return anchor('receipt', 'anchorReceipt', payloadHash, artifactRoot, subjectHash);
}

export async function anchorEntitlement(
    payloadHash: `0x${string}`,
    artifactRoot: `0x${string}`,
    subjectHash: `0x${string}`,
) {
    return anchor('entitlement', 'anchorEntitlement', payloadHash, artifactRoot, subjectHash);
}

export async function anchorProfile(
    payloadHash: `0x${string}`,
    artifactRoot: `0x${string}`,
    subjectHash: `0x${string}`,
) {
    return anchor('profile', 'anchorProfile', payloadHash, artifactRoot, subjectHash);
}

export async function checkZeroGChainHealth() {
    const startedAt = Date.now();
    const publicClient = getZeroGPublicClient();
    const writerAccount = zeroGEnv.chainPrivateKey
        ? privateKeyToAccount(zeroGEnv.chainPrivateKey as `0x${string}`)
        : null;

    const [blockNumber, receiptAnchorBytecode, writerBalance] = await Promise.all([
        publicClient.getBlockNumber(),
        zeroGEnv.receiptAnchorAddress
            ? publicClient.getBytecode({ address: zeroGEnv.receiptAnchorAddress as `0x${string}` })
            : Promise.resolve(null),
        writerAccount
            ? publicClient.getBalance({ address: writerAccount.address })
            : Promise.resolve(null),
    ]);

    return {
        enabled: zeroGEnv.enabled,
        configured: Boolean(zeroGEnv.chainRpcUrl),
        chainId: zeroGEnv.chainId,
        latestBlock: blockNumber.toString(),
        latencyMs: Date.now() - startedAt,
        receiptAnchorAddress: zeroGEnv.receiptAnchorAddress || null,
        receiptAnchorDeployed: Boolean(receiptAnchorBytecode && receiptAnchorBytecode !== '0x'),
        receiptAnchorContractUrl: zeroGEnv.receiptAnchorAddress
            ? `${zeroGEnv.chainScanBaseUrl}/address/${zeroGEnv.receiptAnchorAddress}`
            : null,
        writerAddress: writerAccount?.address ?? null,
        writerAddressUrl: writerAccount?.address
            ? `${zeroGEnv.chainScanBaseUrl}/address/${writerAccount.address}`
            : null,
        writerBalance0G: writerBalance !== null ? formatEther(writerBalance) : null,
        explorerBaseUrl: zeroGEnv.chainScanBaseUrl,
        precompiles: {
            daSigners: ZERO_G_DA_SIGNERS_PRECOMPILE,
            wrapped0GBase: ZERO_G_WRAPPED_0G_BASE_PRECOMPILE,
        },
    };
}
