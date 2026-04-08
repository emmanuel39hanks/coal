import { createPublicClient, createWalletClient, http, parseAbi, parseUnits, formatUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;
const USDC_DECIMALS = 6;
const MAX_PAYMENT_USD = 5;
const TX_TIMEOUT_MS = 30_000;

const USDC_ABI = parseAbi([
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
]);

export function getAgentAccount() {
  const key = process.env.AGENT_WALLET_PRIVATE_KEY;
  if (!key) throw new Error('AGENT_WALLET_PRIVATE_KEY not configured');
  return privateKeyToAccount(key as `0x${string}`);
}

export function getPublicClient() {
  const rpcUrl = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
  return createPublicClient({ chain: base, transport: http(rpcUrl) });
}

export function getWalletClient() {
  const rpcUrl = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
  return createWalletClient({
    chain: base,
    transport: http(rpcUrl),
    account: getAgentAccount(),
  });
}

export async function getUsdcBalance(): Promise<{ address: string; balance: string; balanceRaw: string }> {
  const account = getAgentAccount();
  const client = getPublicClient();
  const raw = await client.readContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: 'balanceOf',
    args: [account.address],
  });
  return {
    address: account.address,
    balance: formatUnits(raw, USDC_DECIMALS),
    balanceRaw: raw.toString(),
  };
}

export async function sendUsdc(
  to: string,
  amountUsd: number,
): Promise<{ txHash: string; amount: string; to: string; from: string }> {
  if (amountUsd <= 0) throw new Error('Amount must be positive');
  if (amountUsd > MAX_PAYMENT_USD) throw new Error(`Amount exceeds $${MAX_PAYMENT_USD} safety cap`);

  const recipient = to as `0x${string}`;
  const amountRaw = parseUnits(amountUsd.toFixed(USDC_DECIMALS), USDC_DECIMALS);

  const publicClient = getPublicClient();
  const walletClient = getWalletClient();
  const account = getAgentAccount();

  // Check balance first
  const balance = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: 'balanceOf',
    args: [account.address],
  });

  if (balance < amountRaw) {
    const available = formatUnits(balance, USDC_DECIMALS);
    throw new Error(`Insufficient USDC balance. Have ${available}, need ${amountUsd.toFixed(2)}`);
  }

  // Simulate first to catch reverts early
  await publicClient.simulateContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: 'transfer',
    args: [recipient, amountRaw],
    account: account.address,
  });

  // Execute
  const hash = await walletClient.writeContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: 'transfer',
    args: [recipient, amountRaw],
  });

  // Wait for receipt with timeout
  await Promise.race([
    publicClient.waitForTransactionReceipt({ hash }),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Transaction confirmation timeout')), TX_TIMEOUT_MS),
    ),
  ]);

  return {
    txHash: hash,
    amount: amountUsd.toFixed(2),
    to: recipient,
    from: account.address,
  };
}
