import { createPublicClient, http, parseAbi, parseUnits, formatUnits, encodeFunctionData } from 'viem';
import { base } from 'viem/chains';
import { PrivyClient } from '@privy-io/node';

const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;
const USDC_DECIMALS = 6;
const MAX_PAYMENT_USD = 5;

const ERC20_ABI = parseAbi([
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
]);

// ─── Privy Client ───────────────────────────────────────────────────────────

function getPrivyClient() {
  const appId = process.env.PRIVY_APP_ID || process.env.NEXT_PUBLIC_PRIVY_APP_ID || '';
  const appSecret = process.env.PRIVY_APP_SECRET || '';
  if (!appId || !appSecret) throw new Error('Privy credentials not configured');
  return new PrivyClient({ appId, appSecret });
}

// ─── Public Client ──────────────────────────────────────────────────────────

export function getPublicClient() {
  const rpcUrl = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
  return createPublicClient({ chain: base, transport: http(rpcUrl) });
}

// ─── Per-User Wallet ────────────────────────────────────────────────────────

export async function getOrCreateUserWallet(userId: string): Promise<{ walletId: string; address: string }> {
  const privy = getPrivyClient();
  const wallet = await privy.wallets().create({ chain_type: 'ethereum' });
  return { walletId: wallet.id, address: wallet.address };
}

// ─── Balance ────────────────────────────────────────────────────────────────

export async function getUsdcBalance(address: string): Promise<{ address: string; balance: string; balanceRaw: string }> {
  const client = getPublicClient();
  const raw = await client.readContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address as `0x${string}`],
  });
  return {
    address,
    balance: formatUnits(raw, USDC_DECIMALS),
    balanceRaw: raw.toString(),
  };
}

// ─── Send USDC ──────────────────────────────────────────────────────────────

export async function sendUsdc(
  walletId: string,
  to: string,
  amountUsd: number,
): Promise<{ txHash: string; amount: string; to: string; from: string }> {
  if (amountUsd <= 0) throw new Error('Amount must be positive');
  if (amountUsd > MAX_PAYMENT_USD) throw new Error(`Amount exceeds $${MAX_PAYMENT_USD} safety cap`);

  const privy = getPrivyClient();

  // Get wallet address for balance check
  const amountRaw = parseUnits(amountUsd.toFixed(USDC_DECIMALS), USDC_DECIMALS);
  const calldata = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: 'transfer',
    args: [to as `0x${string}`, amountRaw],
  });

  // Send via Privy wallets RPC
  const result = await privy.wallets().ethereum().sendTransaction(walletId, {
    caip2: 'eip155:8453',
    params: {
      transaction: {
        to: USDC_ADDRESS,
        data: calldata,
        value: 0,
      },
    },
  });

  const txHash = (result as any).hash || (result as any).transaction_hash || '';

  // Wait for confirmation
  if (txHash) {
    const publicClient = getPublicClient();
    try {
      await publicClient.waitForTransactionReceipt({ hash: txHash as `0x${string}`, timeout: 30_000 });
    } catch {}
  }

  return {
    txHash,
    amount: amountUsd.toFixed(2),
    to,
    from: walletId,
  };
}

// ─── Withdraw ───────────────────────────────────────────────────────────────

export async function withdrawUsdc(
  walletId: string,
  toAddress: string,
  amount?: number,
): Promise<{ txHash: string; amount: string; to: string }> {
  // We need the wallet address to check balance — for now use the RPC
  // The walletId IS the wallet, Privy handles the address internally
  const privy = getPrivyClient();

  const calldata = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: 'transfer',
    args: [toAddress as `0x${string}`, parseUnits((amount ?? 0).toFixed(USDC_DECIMALS), USDC_DECIMALS)],
  });

  const result = await privy.wallets().ethereum().sendTransaction(walletId, {
    caip2: 'eip155:8453',
    params: {
      transaction: {
        to: USDC_ADDRESS,
        data: calldata,
        value: 0,
      },
    },
  });

  return {
    txHash: (result as any).hash || (result as any).transaction_hash || 'pending',
    amount: (amount ?? 0).toFixed(2),
    to: toAddress,
  };
}
