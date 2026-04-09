import {
  createPublicClient, createWalletClient, http,
  parseAbi, parseUnits, formatUnits, encodeFunctionData,
  keccak256, toBytes,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { PrivyClient } from '@privy-io/node';
import crypto from 'crypto';

const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;
const USDC_DECIMALS = 6;
const MAX_PAYMENT_USD = 5;

const ERC20_ABI = parseAbi([
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
]);

// ERC-3009 transferWithAuthorization — operator pays gas, agent wallet signs
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

// ─── Privy Client ───────────────────────────────────────────────────────────

function getPrivyClient() {
  const appId = process.env.PRIVY_APP_ID || process.env.NEXT_PUBLIC_PRIVY_APP_ID || '';
  const appSecret = process.env.PRIVY_APP_SECRET || '';
  if (!appId || !appSecret) throw new Error('Privy credentials not configured');
  return new PrivyClient({ appId, appSecret });
}

// ─── Operator Wallet (pays gas for relay) ───────────────────────────────────

function getOperatorWalletClient() {
  const key = process.env.OPERATOR_PRIVATE_KEY;
  if (!key) throw new Error('OPERATOR_PRIVATE_KEY not configured');
  const rpcUrl = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
  return createWalletClient({
    chain: base,
    transport: http(rpcUrl),
    account: privateKeyToAccount(key as `0x${string}`),
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

// ─── Send USDC via ERC-3009 (gasless for agent wallet) ──────────────────────

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

  // Generate random nonce for ERC-3009 (NOT the ethereum tx nonce)
  const authNonce = keccak256(toBytes(crypto.randomUUID())) as Hex;
  const validAfter = BigInt(0);
  const validBefore = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 hour

  // Step 1: Sign EIP-712 transferWithAuthorization with Privy wallet (no gas needed)
  const signResult = await privy.wallets().ethereum().signTypedData(walletId, {
    params: {
      typed_data: {
        domain: USDC_EIP712_DOMAIN as any,
        types: TRANSFER_WITH_AUTH_TYPES as any,
        primary_type: 'TransferWithAuthorization',
        message: {
          from: walletAddress,
          to: recipient,
          value: amountRaw.toString(),
          validAfter: validAfter.toString(),
          validBefore: validBefore.toString(),
          nonce: authNonce,
        },
      },
    },
  });

  const signature = (signResult as any).signature || (signResult as any).data || '';
  if (!signature || signature.length < 132) {
    throw new Error('Failed to get signature from Privy wallet');
  }

  // Step 2: Split signature into r, s, v
  const r = ('0x' + signature.slice(2, 66)) as Hex;
  const s = ('0x' + signature.slice(66, 130)) as Hex;
  const v = parseInt(signature.slice(130, 132), 16);

  // Step 3: Operator submits transferWithAuthorization (operator pays gas)
  const operatorClient = getOperatorWalletClient();
  const txHash = await operatorClient.writeContract({
    address: USDC_ADDRESS,
    abi: TRANSFER_WITH_AUTH_ABI,
    functionName: 'transferWithAuthorization',
    args: [
      walletAddress,
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
  try {
    await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 30_000 });
  } catch {}

  return {
    txHash,
    amount: amountUsd.toFixed(2),
    to: recipient,
    from: walletAddress,
  };
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
