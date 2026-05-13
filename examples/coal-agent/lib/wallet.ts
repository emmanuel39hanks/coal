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

/**
 * HMAC-sign a (walletId, walletAddress) pair so the server can detect any
 * client-side tampering. Returned to the client at wallet-creation time and
 * required on every payment request.
 *
 * Why: previously the chat route accepted ANY walletId from the request body
 * with zero verification — anyone who learned a target's walletId could drain
 * it ($5/tx cap). Adding an HMAC signature makes walletIds unforgeable: an
 * attacker would need both the walletId AND the signature, which the server
 * issues only at wallet creation.
 *
 * This is not a full session-cookie auth — that's the longer-term fix. But it
 * raises the bar from "knowing the walletId is enough" to "you need a fresh
 * server-issued signature."
 */
export function signWalletBinding(walletId: string, walletAddress: string): string {
  const secret = process.env.WALLET_BINDING_SECRET || '';
  if (!secret) throw new Error('WALLET_BINDING_SECRET not configured');
  return crypto
    .createHmac('sha256', secret)
    .update(`${walletId}|${walletAddress.toLowerCase()}`)
    .digest('hex');
}

export function verifyWalletBinding(walletId: string, walletAddress: string, signature: string): boolean {
  const secret = process.env.WALLET_BINDING_SECRET || '';
  if (!secret || !signature || !walletId || !walletAddress) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${walletId}|${walletAddress.toLowerCase()}`)
    .digest('hex');
  // constant-time compare
  if (signature.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

export async function createUserWallet(): Promise<{ walletId: string; address: string; signature: string }> {
  const privy = getPrivyClient();
  const wallet = await privy.wallets().create({ chain_type: 'ethereum' });
  const signature = signWalletBinding(wallet.id, wallet.address);
  return { walletId: wallet.id, address: wallet.address, signature };
}

/** @deprecated Use createUserWallet — this misnomer never actually got-or-created. */
export async function getOrCreateUserWallet(_userId: string): Promise<{ walletId: string; address: string }> {
  const w = await createUserWallet();
  return { walletId: w.walletId, address: w.address };
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

// ─── x402 client (agent pays paywall directly per x402 spec) ───────────────

export interface X402PaymentResponse {
  success: boolean;
  transaction?: string;
  network?: string;
  payer?: string;
  errorReason?: string | null;
}

export interface X402PayResult {
  txHash: string;
  amount: string;
  payer: string;
  payTo: string;
  network: string;
  verifyUrl: string;
  body: unknown;
  response: X402PaymentResponse | null;
  explorerUrl?: string;
  /**
   * True when no on-chain settlement happened — the server short-circuited
   * because this wallet already had access (one_time paywall). The agent did
   * NOT pay anything new on-chain. UI should reflect this clearly.
   */
  cached: boolean;
}

/**
 * Pay an x402 paywall: sign an EIP-3009 transferWithAuthorization with the
 * agent's Privy wallet, encode as a base64 X-PAYMENT header, and POST to the
 * paywall's verify URL. The server (Coal facilitator) validates and submits
 * on-chain via its operator wallet, so the agent wallet never needs ETH.
 *
 * @see https://x402.org
 */
export async function payX402Paywall(
  walletId: string,
  opts: {
    verifyUrl: string;
    priceUsd: number;
    payTo: string;
    network?: string;
    validitySeconds?: number;
  },
): Promise<X402PayResult> {
  if (opts.priceUsd <= 0) throw new Error('priceUsd must be positive');
  if (opts.priceUsd > MAX_PAYMENT_USD) throw new Error(`Amount exceeds $${MAX_PAYMENT_USD} safety cap`);
  if (!/^https?:\/\//.test(opts.verifyUrl)) throw new Error('verifyUrl must be absolute http(s) URL');

  const privy = getPrivyClient();
  const wallet = await getWalletById(walletId);
  const walletAddress = wallet.address as `0x${string}`;
  const recipient = opts.payTo as `0x${string}`;
  const amountRaw = parseUnits(opts.priceUsd.toFixed(USDC_DECIMALS), USDC_DECIMALS);

  // Check balance early (cheaper than a failed sig + POST round-trip)
  const publicClient = getPublicClient();
  const balance = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [walletAddress],
  });
  if (balance < amountRaw) {
    throw new Error(`Insufficient USDC. Have ${formatUnits(balance, USDC_DECIMALS)}, need ${opts.priceUsd.toFixed(2)}`);
  }

  const authNonce = keccak256(toBytes(crypto.randomUUID())) as Hex;
  const validAfter = BigInt(0);
  const validBefore = BigInt(Math.floor(Date.now() / 1000) + (opts.validitySeconds ?? 300));

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

  const network = opts.network || `eip155:${USDC_EIP712_DOMAIN.chainId}`;
  const paymentPayload = {
    x402Version: 1,
    scheme: 'exact' as const,
    network,
    payload: {
      signature,
      authorization: {
        from: walletAddress,
        to: recipient,
        value: amountRaw.toString(),
        validAfter: validAfter.toString(),
        validBefore: validBefore.toString(),
        nonce: authNonce,
      },
    },
  };

  const xPayment = Buffer.from(JSON.stringify(paymentPayload), 'utf-8').toString('base64');

  const res = await fetch(opts.verifyUrl, {
    method: 'POST',
    headers: {
      'X-PAYMENT': xPayment,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: '{}',
  });

  const xPaymentResponseHeader = res.headers.get('x-payment-response') || res.headers.get('X-PAYMENT-RESPONSE');
  let response: X402PaymentResponse | null = null;
  if (xPaymentResponseHeader) {
    try {
      const decoded = Buffer.from(xPaymentResponseHeader, 'base64').toString('utf-8');
      response = JSON.parse(decoded);
    } catch {
      // ignore — server didn't send canonical x402 response header
    }
  }

  const body = await res.json().catch(() => ({} as Record<string, unknown>));

  if (!res.ok) {
    const reason = response?.errorReason
      || (body as { error?: string; reason?: string }).reason
      || (body as { error?: string }).error
      || `HTTP ${res.status}`;
    throw new Error(`x402 payment failed: ${reason}`);
  }

  // A FRESH settlement is signaled by the server returning a transaction in
  // X-PAYMENT-RESPONSE or via the X-Payment-Tx-Hash header. Anything else
  // (e.g. body.entitlement.txHash from a prior payment) is just cached state.
  const freshTxHash = response?.transaction || res.headers.get('x-payment-tx-hash') || '';
  const cached = !freshTxHash;
  const txHash = freshTxHash; // empty string when cached
  const explorerUrl = res.headers.get('x-payment-explorer') || (freshTxHash ? `https://basescan.org/tx/${freshTxHash}` : undefined);

  return {
    txHash,
    amount: opts.priceUsd.toFixed(2),
    payer: walletAddress,
    payTo: recipient,
    network,
    verifyUrl: opts.verifyUrl,
    body,
    response,
    explorerUrl,
    cached,
  };
}

// ─── APP (OKX Agent Payments Protocol) client ──────────────────────────────

export interface AppPaymentResponse {
  success: boolean;
  status: 'success' | 'pending' | 'failed' | 'timeout';
  transaction?: string;
  network?: string;
  payer?: string;
  errorReason?: string | null;
}

export interface AppPayResult extends Omit<X402PayResult, 'response'> {
  response: AppPaymentResponse | null;
  protocol: 'app-v2';
  scheme: 'exact' | 'aggr_deferred' | 'deferred';
  status: 'success' | 'pending' | 'failed' | 'timeout';
}

/**
 * Pay a paywall using OKX Agent Payments Protocol (APP / x402 v2).
 *
 * APP is byte-compatible with x402 at the signature layer — the same
 * EIP-3009 transferWithAuthorization that signs an x402 v1 payload also
 * signs an APP v2 payload. The only difference is the envelope:
 *   - v1: `{ x402Version: 1, scheme, network, payload }`
 *   - v2: `{ x402Version: 2, payload, accepted: { scheme, network, asset, amount, payTo } }`
 *
 * Coal's verify endpoint detects v2 by inspecting `x402Version` and routes
 * to its APP settler, which reshapes back to v1 internally and shares the
 * same on-chain submission code path. From the agent's perspective this is
 * one POST and one signed authorization.
 *
 * @see https://github.com/okx/payments
 * @see https://web3.okx.com/whitepaper/okx-app-whitepaper.pdf
 */
export async function payAppPaywall(
  walletId: string,
  opts: {
    verifyUrl: string;
    priceUsd: number;
    payTo: string;
    /** CAIP-2 network identifier. Defaults to eip155:8453 (Base). */
    network?: string;
    /** Settlement asset address. Defaults to USDC on Base. */
    asset?: string;
    /** APP scheme. `exact` for sync per-call, `aggr_deferred` for batched. */
    scheme?: 'exact' | 'aggr_deferred';
    validitySeconds?: number;
  },
): Promise<AppPayResult> {
  if (opts.priceUsd <= 0) throw new Error('priceUsd must be positive');
  if (opts.priceUsd > MAX_PAYMENT_USD) throw new Error(`Amount exceeds $${MAX_PAYMENT_USD} safety cap`);
  if (!/^https?:\/\//.test(opts.verifyUrl)) throw new Error('verifyUrl must be absolute http(s) URL');

  const privy = getPrivyClient();
  const wallet = await getWalletById(walletId);
  const walletAddress = wallet.address as `0x${string}`;
  const recipient = opts.payTo as `0x${string}`;
  const amountRaw = parseUnits(opts.priceUsd.toFixed(USDC_DECIMALS), USDC_DECIMALS);

  const publicClient = getPublicClient();
  const balance = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [walletAddress],
  });
  if (balance < amountRaw) {
    throw new Error(`Insufficient USDC. Have ${formatUnits(balance, USDC_DECIMALS)}, need ${opts.priceUsd.toFixed(2)}`);
  }

  const authNonce = keccak256(toBytes(crypto.randomUUID())) as Hex;
  const validAfter = BigInt(0);
  const validBefore = BigInt(Math.floor(Date.now() / 1000) + (opts.validitySeconds ?? 300));

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

  const network = opts.network || `eip155:${USDC_EIP712_DOMAIN.chainId}`;
  const asset = opts.asset || USDC_ADDRESS;
  const scheme = opts.scheme || 'exact';

  // APP v2 envelope per OKX/payments SDK + the x402 v2 spec.
  const paymentPayload = {
    x402Version: 2,
    payload: {
      signature,
      authorization: {
        from: walletAddress,
        to: recipient,
        value: amountRaw.toString(),
        validAfter: validAfter.toString(),
        validBefore: validBefore.toString(),
        nonce: authNonce,
      },
    },
    accepted: {
      scheme,
      network,
      asset,
      amount: amountRaw.toString(),
      payTo: recipient,
      maxTimeoutSeconds: opts.validitySeconds ?? 300,
    },
  };

  const xPayment = Buffer.from(JSON.stringify(paymentPayload), 'utf-8').toString('base64');

  const res = await fetch(opts.verifyUrl, {
    method: 'POST',
    headers: {
      'X-PAYMENT': xPayment,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: '{}',
  });

  const xPaymentResponseHeader = res.headers.get('x-payment-response') || res.headers.get('X-PAYMENT-RESPONSE');
  let response: AppPaymentResponse | null = null;
  if (xPaymentResponseHeader) {
    try {
      const decoded = Buffer.from(xPaymentResponseHeader, 'base64').toString('utf-8');
      response = JSON.parse(decoded);
    } catch {
      // ignore — server didn't send canonical APP response header
    }
  }

  const body = await res.json().catch(() => ({} as Record<string, unknown>));

  if (!res.ok) {
    const reason = response?.errorReason
      || (body as { error?: string; reason?: string }).reason
      || (body as { error?: string }).error
      || `HTTP ${res.status}`;
    throw new Error(`APP payment failed: ${reason}`);
  }

  const freshTxHash = response?.transaction || res.headers.get('x-payment-tx-hash') || '';
  const cached = !freshTxHash;
  const explorerUrl = res.headers.get('x-payment-explorer') || (freshTxHash ? `https://basescan.org/tx/${freshTxHash}` : undefined);

  return {
    txHash: freshTxHash,
    amount: opts.priceUsd.toFixed(2),
    payer: walletAddress,
    payTo: recipient,
    network,
    verifyUrl: opts.verifyUrl,
    body,
    response,
    explorerUrl,
    cached,
    protocol: 'app-v2',
    scheme,
    status: response?.status || (freshTxHash ? 'success' : 'failed'),
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
