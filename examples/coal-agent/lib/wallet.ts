import {
  createPublicClient, createWalletClient, http,
  parseAbi, parseUnits, formatUnits, encodeFunctionData,
  keccak256, encodePacked, toHex, hexToBytes, concat, pad,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { PrivyClient } from '@privy-io/node';

const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;
const USDC_DECIMALS = 6;
const MAX_PAYMENT_USD = 5;

const ERC20_ABI = parseAbi([
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
  'function nonces(address owner) view returns (uint256)',
  'function DOMAIN_SEPARATOR() view returns (bytes32)',
]);

// ERC-3009 transferWithAuthorization ABI
const ERC3009_ABI = parseAbi([
  'function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s)',
]);

// ─── Privy Client ───────────────────────────────────────────────────────────

function getPrivyClient() {
  const appId = process.env.PRIVY_APP_ID || process.env.NEXT_PUBLIC_PRIVY_APP_ID || '';
  const appSecret = process.env.PRIVY_APP_SECRET || '';
  if (!appId || !appSecret) throw new Error('Privy credentials not configured');
  return new PrivyClient({ appId, appSecret });
}

// ─── Operator Wallet (pays gas for agent transactions) ──────────────────────

function getOperatorAccount() {
  const key = process.env.OPERATOR_PRIVATE_KEY || process.env.AGENT_WALLET_PRIVATE_KEY;
  if (!key) throw new Error('OPERATOR_PRIVATE_KEY not configured');
  return privateKeyToAccount(key as `0x${string}`);
}

function getOperatorWalletClient() {
  const rpcUrl = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
  return createWalletClient({
    chain: base,
    transport: http(rpcUrl),
    account: getOperatorAccount(),
  });
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

export async function getWalletById(walletId: string): Promise<{ address: string }> {
  const appId = process.env.PRIVY_APP_ID || process.env.NEXT_PUBLIC_PRIVY_APP_ID || '';
  const appSecret = process.env.PRIVY_APP_SECRET || '';
  const response = await fetch(`https://api.privy.io/v1/wallets/${walletId}`, {
    headers: {
      'Authorization': `Basic ${Buffer.from(`${appId}:${appSecret}`).toString('base64')}`,
      'privy-app-id': appId,
    },
  });
  if (!response.ok) throw new Error('Wallet not found');
  const wallet = await response.json();
  return { address: wallet.address };
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

// ─── Send USDC via Privy sign + Operator relay ──────────────────────────────

export async function sendUsdc(
  walletId: string,
  to: string,
  amountUsd: number,
): Promise<{ txHash: string; amount: string; to: string; from: string }> {
  if (amountUsd <= 0) throw new Error('Amount must be positive');
  if (amountUsd > MAX_PAYMENT_USD) throw new Error(`Amount exceeds $${MAX_PAYMENT_USD} safety cap`);

  const privy = getPrivyClient();
  const wallet = await getWalletById(walletId);
  const walletAddress = wallet.address as `0x${string}`;
  const recipient = to as `0x${string}`;
  const amountRaw = parseUnits(amountUsd.toFixed(USDC_DECIMALS), USDC_DECIMALS);

  // Check balance
  const publicClient = getPublicClient();
  const balance = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [walletAddress],
  });
  if (balance < amountRaw) {
    throw new Error(`Insufficient USDC. Have ${formatUnits(balance, USDC_DECIMALS)}, need ${amountUsd.toFixed(2)}`);
  }

  // Try direct transfer via Privy first (simplest)
  // Operator wallet pays gas by submitting a standard ERC-20 transfer
  // signed by the Privy wallet
  const calldata = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: 'transfer',
    args: [recipient, amountRaw],
  });

  try {
    // Try Privy server wallet RPC with gas sponsorship
    const result = await privy.wallets().ethereum().sendTransaction(walletId, {
      caip2: 'eip155:8453',
      params: {
        transaction: {
          to: USDC_ADDRESS,
          data: calldata,
          value: 0,
        },
      },
      sponsor: true,
    });

    const txHash = (result as any).hash || (result as any).transaction_hash || '';
    if (txHash) {
      try {
        await publicClient.waitForTransactionReceipt({ hash: txHash as `0x${string}`, timeout: 30_000 });
      } catch {}
      return { txHash, amount: amountUsd.toFixed(2), to: recipient, from: walletAddress };
    }
  } catch (sponsorError) {
    // Gas sponsorship failed — fall back to operator-funded direct transfer
    console.log('Gas sponsorship failed, falling back to operator relay:', (sponsorError as Error).message);
  }

  // Fallback: Use Privy to sign, but without sponsorship
  // First drip a tiny ETH amount from operator to agent wallet for gas
  try {
    const operatorClient = getOperatorWalletClient();
    const gasDripAmount = parseUnits('0.0001', 18); // ~$0.25, enough for many txs

    // Check if agent wallet already has some ETH
    const ethBalance = await publicClient.getBalance({ address: walletAddress });
    if (ethBalance < parseUnits('0.00005', 18)) {
      const dripHash = await operatorClient.sendTransaction({
        to: walletAddress,
        value: gasDripAmount,
      });
      await publicClient.waitForTransactionReceipt({ hash: dripHash, timeout: 15_000 });
    }

    // Now send the USDC transfer via Privy (agent wallet has gas)
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
    if (txHash) {
      try {
        await publicClient.waitForTransactionReceipt({ hash: txHash as `0x${string}`, timeout: 30_000 });
      } catch {}
    }

    return { txHash, amount: amountUsd.toFixed(2), to: recipient, from: walletAddress };
  } catch (fallbackError) {
    throw new Error(`Payment failed: ${(fallbackError as Error).message}`);
  }
}

// ─── Withdraw ───────────────────────────────────────────────────────────────

export async function withdrawUsdc(
  walletId: string,
  toAddress: string,
  amount?: number,
): Promise<{ txHash: string; amount: string; to: string }> {
  const wallet = await getWalletById(walletId);
  const { balance } = await getUsdcBalance(wallet.address);
  const available = parseFloat(balance);
  if (available <= 0) throw new Error('No USDC balance to withdraw');

  const withdrawAmount = amount ?? available;
  if (withdrawAmount > available) throw new Error(`Cannot withdraw ${withdrawAmount}. Available: ${available}`);

  const result = await sendUsdc(walletId, toAddress, withdrawAmount);
  return {
    txHash: result.txHash,
    amount: withdrawAmount.toFixed(2),
    to: toAddress,
  };
}
