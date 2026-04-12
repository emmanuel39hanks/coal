/**
 * Agent wallet for autonomous MCP payments.
 *
 * When AGENT_PRIVATE_KEY is set, the MCP server can sign ERC-3009
 * transferWithAuthorization messages and submit them through Coal's
 * operator relay — gasless payments from Claude/ChatGPT/any MCP client.
 *
 * The private key controls a simple EOA wallet with USDC on Base.
 * The operator wallet (Coal's side) pays the ~$0.001 gas per transaction.
 * The agent wallet never needs ETH.
 *
 * Security model:
 * - Private key stays in the server's env vars (never sent over the wire)
 * - Spending cap: AGENT_MAX_SPEND_PER_TX (default $5)
 * - Every payment gets a verifiable receipt on 0G
 * - Audit trail: every tx is on-chain on Base + anchored on 0G Chain
 */

import {
    createPublicClient,
    createWalletClient,
    http,
    parseAbi,
    parseUnits,
    formatUnits,
    keccak256,
    toBytes,
    type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import crypto from 'crypto';

const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;
const USDC_DECIMALS = 6;
const BASE_RPC = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
const OPERATOR_KEY = process.env.OPERATOR_PRIVATE_KEY || '';
const AGENT_KEY = process.env.AGENT_PRIVATE_KEY || '';
const MAX_PER_TX = parseFloat(process.env.AGENT_MAX_SPEND_PER_TX || '5');

const ERC20_ABI = parseAbi([
    'function balanceOf(address owner) view returns (uint256)',
]);

const TRANSFER_WITH_AUTH_ABI = parseAbi([
    'function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s)',
]);

const USDC_EIP712_DOMAIN = {
    name: 'USD Coin',
    version: '2',
    chainId: 8453,
    verifyingContract: USDC_ADDRESS as Hex,
} as const;

const TRANSFER_WITH_AUTH_TYPES = {
    TransferWithAuthorization: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' },
    ],
} as const;

// ─── Status checks ──────────────────────────────────────────────────────────

export function isWalletConfigured(): boolean {
    return Boolean(AGENT_KEY && OPERATOR_KEY);
}

export function getAgentAddress(): string | null {
    if (!AGENT_KEY) return null;
    return privateKeyToAccount(AGENT_KEY as `0x${string}`).address;
}

export async function getAgentBalance(): Promise<{ address: string; balance: string } | null> {
    const address = getAgentAddress();
    if (!address) return null;

    const client = createPublicClient({ chain: base, transport: http(BASE_RPC) });
    const raw = await client.readContract({
        address: USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [address as `0x${string}`],
    });

    return {
        address,
        balance: formatUnits(raw, USDC_DECIMALS),
    };
}

// ─── ERC-3009 Payment ────────────────────────────────────────────────────────

export async function payViaERC3009(
    to: string,
    amountUsd: number,
): Promise<{ txHash: string; from: string; to: string; amount: string }> {
    if (!AGENT_KEY) throw new Error('AGENT_PRIVATE_KEY not configured');
    if (!OPERATOR_KEY) throw new Error('OPERATOR_PRIVATE_KEY not configured');
    if (amountUsd <= 0) throw new Error('Amount must be positive');
    if (amountUsd > MAX_PER_TX) throw new Error(`Amount $${amountUsd} exceeds spending cap of $${MAX_PER_TX}`);

    const agentAccount = privateKeyToAccount(AGENT_KEY as `0x${string}`);
    const operatorAccount = privateKeyToAccount(OPERATOR_KEY as `0x${string}`);
    const publicClient = createPublicClient({ chain: base, transport: http(BASE_RPC) });
    const operatorClient = createWalletClient({
        chain: base,
        transport: http(BASE_RPC),
        account: operatorAccount,
    });

    const recipient = to as `0x${string}`;
    const amountRaw = parseUnits(amountUsd.toFixed(USDC_DECIMALS), USDC_DECIMALS);

    // Check balance
    const balance = await publicClient.readContract({
        address: USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [agentAccount.address],
    });
    if (balance < amountRaw) {
        throw new Error(
            `Insufficient USDC. Agent wallet ${agentAccount.address} has ${formatUnits(balance, USDC_DECIMALS)}, needs ${amountUsd.toFixed(2)}`,
        );
    }

    // ERC-3009 nonce (random, not the ethereum tx nonce)
    const authNonce = keccak256(toBytes(crypto.randomUUID())) as Hex;
    const validAfter = BigInt(0);
    const validBefore = BigInt(Math.floor(Date.now() / 1000) + 3600);

    // Step 1: Agent wallet signs the transferWithAuthorization
    const signature = await agentAccount.signTypedData({
        domain: USDC_EIP712_DOMAIN,
        types: TRANSFER_WITH_AUTH_TYPES,
        primaryType: 'TransferWithAuthorization',
        message: {
            from: agentAccount.address,
            to: recipient,
            value: amountRaw,
            validAfter,
            validBefore,
            nonce: authNonce,
        },
    });

    // Step 2: Split signature
    const r = ('0x' + signature.slice(2, 66)) as Hex;
    const s = ('0x' + signature.slice(66, 130)) as Hex;
    const v = parseInt(signature.slice(130, 132), 16);

    // Step 3: Operator submits (operator pays gas, ~$0.001)
    const txHash = await operatorClient.writeContract({
        address: USDC_ADDRESS,
        abi: TRANSFER_WITH_AUTH_ABI,
        functionName: 'transferWithAuthorization',
        args: [
            agentAccount.address,
            recipient,
            amountRaw,
            validAfter,
            validBefore,
            authNonce,
            v,
            r,
            s,
        ],
    });

    // Wait for confirmation
    await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 30_000 });

    return {
        txHash,
        from: agentAccount.address,
        to: recipient,
        amount: amountUsd.toFixed(2),
    };
}
