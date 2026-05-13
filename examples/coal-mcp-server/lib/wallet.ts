/**
 * Agent wallet for autonomous MCP payments — PER-USER credentials.
 *
 * Each MCP user passes their OWN agentPrivateKey as a tool argument when
 * calling pay_merchant. The MCP server holds NO long-lived agent keys.
 * Coal's operator wallet pays gas (~$0.001) on every transaction; that's
 * Coal's service contribution.
 *
 * Why per-request keys (not env vars):
 * - One MCP server serves many Claude/Cursor users
 * - A shared key would mean every user pays out of the same wallet
 * - That wallet would be Coal's operator, not the user's own funds
 *
 * Security model:
 * - User's private key arrives in the tool call, used once, never persisted
 * - Spending cap: AGENT_MAX_SPEND_PER_TX (default $5)
 * - Every payment gets a verifiable receipt on 0G
 * - Audit trail: every tx is on-chain on Base + anchored on 0G Chain
 *
 * UX trade-off: passing a private key in chat is suboptimal. The right answer
 * long-term is OAuth → Privy server wallet keyed by Coal account. This file's
 * shape lets us migrate to that without breaking the tool surface — the arg
 * could become `coalSession` later and the server would lookup the wallet.
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
const MAX_PER_TX = parseFloat(process.env.AGENT_MAX_SPEND_PER_TX || '5');

function normalizeKey(key: string): Hex {
    const trimmed = key.trim();
    return (trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`) as Hex;
}

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

/** Operator (gas relay) is a server config. Required for every payment to work. */
export function isOperatorConfigured(): boolean {
    return Boolean(OPERATOR_KEY);
}

/** Resolve an address from any agent private key (provided per-request). */
export function getAgentAddressFromKey(agentPrivateKey: string): string {
    return privateKeyToAccount(normalizeKey(agentPrivateKey)).address;
}

/** Look up USDC balance for any address — public read. */
export async function getUsdcBalanceForAddress(address: string): Promise<{ address: string; balance: string }> {
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

export async function payViaERC3009(params: {
    to: string;
    amountUsd: number;
    agentPrivateKey: string;
}): Promise<{ txHash: string; from: string; to: string; amount: string }> {
    const { to, amountUsd, agentPrivateKey } = params;

    if (!OPERATOR_KEY) {
        throw new Error('Server-side operator key missing (Coal owes you a gas-relay). Email support@usecoal.xyz.');
    }
    if (!agentPrivateKey) {
        throw new Error('agentPrivateKey is required. Pass your wallet private key as a tool argument.');
    }
    if (amountUsd <= 0) throw new Error('Amount must be positive');
    if (amountUsd > MAX_PER_TX) throw new Error(`Amount $${amountUsd} exceeds spending cap of $${MAX_PER_TX}`);

    const agentAccount = privateKeyToAccount(normalizeKey(agentPrivateKey));
    const operatorAccount = privateKeyToAccount(normalizeKey(OPERATOR_KEY));
    const publicClient = createPublicClient({ chain: base, transport: http(BASE_RPC) });
    const operatorClient = createWalletClient({
        chain: base,
        transport: http(BASE_RPC),
        account: operatorAccount,
    });

    const recipient = to as `0x${string}`;
    const amountRaw = parseUnits(amountUsd.toFixed(USDC_DECIMALS), USDC_DECIMALS);

    const balance = await publicClient.readContract({
        address: USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [agentAccount.address],
    });
    if (balance < amountRaw) {
        throw new Error(
            `Insufficient USDC. Your wallet ${agentAccount.address} has ${formatUnits(balance, USDC_DECIMALS)} USDC, needs ${amountUsd.toFixed(2)}. Fund it on Base.`,
        );
    }

    const authNonce = keccak256(toBytes(crypto.randomUUID())) as Hex;
    const validAfter = BigInt(0);
    const validBefore = BigInt(Math.floor(Date.now() / 1000) + 3600);

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

    const r = ('0x' + signature.slice(2, 66)) as Hex;
    const s = ('0x' + signature.slice(66, 130)) as Hex;
    const v = parseInt(signature.slice(130, 132), 16);

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

    await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 30_000 });

    return {
        txHash,
        from: agentAccount.address,
        to: recipient,
        amount: amountUsd.toFixed(2),
    };
}
