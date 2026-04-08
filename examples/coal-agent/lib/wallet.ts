import { createPublicClient, http, parseAbi, parseUnits, formatUnits, encodeFunctionData } from 'viem';
import { base } from 'viem/chains';

const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;
const USDC_DECIMALS = 6;
const MAX_PAYMENT_USD = 5;
const TX_TIMEOUT_MS = 30_000;

const ERC20_ABI = parseAbi([
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
]);

// ─── Privy Server Wallet Config ─────────────────────────────────────────────

const PRIVY_APP_ID = process.env.PRIVY_APP_ID || process.env.NEXT_PUBLIC_PRIVY_APP_ID || '';
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET || '';
const PRIVY_WALLET_ID = process.env.PRIVY_SERVER_WALLET_ID || '';

function getPrivyAuth(): string {
  if (!PRIVY_APP_ID || !PRIVY_APP_SECRET) {
    throw new Error('PRIVY_APP_ID and PRIVY_APP_SECRET are required for server wallet');
  }
  return Buffer.from(`${PRIVY_APP_ID}:${PRIVY_APP_SECRET}`).toString('base64');
}

async function privyRequest(method: string, path: string, body?: Record<string, unknown>) {
  const res = await fetch(`https://api.privy.io${path}`, {
    method,
    headers: {
      'Authorization': `Basic ${getPrivyAuth()}`,
      'privy-app-id': PRIVY_APP_ID,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(TX_TIMEOUT_MS),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.message || `Privy API ${res.status}`);
  }
  return res.json();
}

// ─── Wallet Management ──────────────────────────────────────────────────────

let cachedWalletAddress: string | null = null;

export async function getWalletAddress(): Promise<string> {
  if (cachedWalletAddress) return cachedWalletAddress;

  if (!PRIVY_WALLET_ID) {
    throw new Error('PRIVY_SERVER_WALLET_ID not configured. Create a wallet first.');
  }

  const wallet = await privyRequest('GET', `/v1/wallets/${PRIVY_WALLET_ID}`);
  cachedWalletAddress = wallet.address;
  return wallet.address;
}

export async function createServerWallet(): Promise<{ id: string; address: string }> {
  const wallet = await privyRequest('POST', '/v1/wallets', {
    chain_type: 'ethereum',
  });
  return { id: wallet.id, address: wallet.address };
}

// ─── Public Client (for reads) ──────────────────────────────────────────────

export function getPublicClient() {
  const rpcUrl = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
  return createPublicClient({ chain: base, transport: http(rpcUrl) });
}

// ─── Balance ────────────────────────────────────────────────────────────────

export async function getUsdcBalance(): Promise<{ address: string; balance: string; balanceRaw: string }> {
  const address = await getWalletAddress();
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

// ─── Send USDC via Privy Server Wallet ──────────────────────────────────────

export async function sendUsdc(
  to: string,
  amountUsd: number,
): Promise<{ txHash: string; amount: string; to: string; from: string }> {
  if (amountUsd <= 0) throw new Error('Amount must be positive');
  if (amountUsd > MAX_PAYMENT_USD) throw new Error(`Amount exceeds $${MAX_PAYMENT_USD} safety cap`);

  const walletAddress = await getWalletAddress();
  const recipient = to as `0x${string}`;
  const amountRaw = parseUnits(amountUsd.toFixed(USDC_DECIMALS), USDC_DECIMALS);

  // Check balance first
  const publicClient = getPublicClient();
  const balance = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [walletAddress as `0x${string}`],
  });

  if (balance < amountRaw) {
    const available = formatUnits(balance, USDC_DECIMALS);
    throw new Error(`Insufficient USDC balance. Have ${available}, need ${amountUsd.toFixed(2)}`);
  }

  // Build transfer calldata
  const calldata = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: 'transfer',
    args: [recipient, amountRaw],
  });

  // Send via Privy server wallet RPC
  const result = await privyRequest('POST', `/v1/wallets/${PRIVY_WALLET_ID}/rpc`, {
    method: 'eth_sendTransaction',
    caip2: 'eip155:8453', // Base mainnet
    params: {
      transaction: {
        to: USDC_ADDRESS,
        data: calldata,
        value: 0,
      },
    },
  });

  const txHash = result.data?.hash || result.hash || result.data;
  if (!txHash || typeof txHash !== 'string') {
    throw new Error('Transaction submitted but no hash returned');
  }

  // Wait for confirmation
  try {
    await Promise.race([
      publicClient.waitForTransactionReceipt({ hash: txHash as `0x${string}` }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Transaction confirmation timeout')), TX_TIMEOUT_MS),
      ),
    ]);
  } catch {
    // Transaction submitted — might still confirm. Return hash anyway.
  }

  return {
    txHash,
    amount: amountUsd.toFixed(2),
    to: recipient,
    from: walletAddress,
  };
}

// ─── Withdraw (send remaining balance to external address) ──────────────────

export async function withdrawUsdc(
  toAddress: string,
  amount?: number,
): Promise<{ txHash: string; amount: string; to: string }> {
  const { balance } = await getUsdcBalance();
  const available = parseFloat(balance);

  if (available <= 0) throw new Error('No USDC balance to withdraw');

  const withdrawAmount = amount ?? available;
  if (withdrawAmount > available) {
    throw new Error(`Cannot withdraw ${withdrawAmount}. Available: ${available}`);
  }
  if (withdrawAmount <= 0) throw new Error('Withdraw amount must be positive');

  // Bypass the $5 cap for withdrawals — user is getting their own money back
  const walletAddress = await getWalletAddress();
  const recipient = toAddress as `0x${string}`;
  const amountRaw = parseUnits(withdrawAmount.toFixed(USDC_DECIMALS), USDC_DECIMALS);

  const calldata = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: 'transfer',
    args: [recipient, amountRaw],
  });

  const result = await privyRequest('POST', `/v1/wallets/${PRIVY_WALLET_ID}/rpc`, {
    method: 'eth_sendTransaction',
    caip2: 'eip155:8453',
    params: {
      transaction: {
        to: USDC_ADDRESS,
        data: calldata,
        value: 0,
      },
    },
  });

  const txHash = result.data?.hash || result.hash || result.data;

  return {
    txHash: txHash || 'pending',
    amount: withdrawAmount.toFixed(2),
    to: toAddress,
  };
}
