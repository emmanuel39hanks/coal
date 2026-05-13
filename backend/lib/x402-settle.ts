/**
 * x402 facilitator — server-side settlement.
 *
 * Implements the x402 protocol's payment settlement step. When an agent POSTs
 * to a paywall verify URL with an `X-PAYMENT` header containing a signed
 * EIP-3009 `transferWithAuthorization`, this module:
 *
 *   1. Decodes + validates the payload against the paywall's requirements
 *   2. Submits the signed authorization on-chain (operator pays gas)
 *   3. Returns the on-chain tx hash for the X-PAYMENT-RESPONSE header
 *
 * Coal acts as the facilitator. The agent's wallet never needs ETH.
 *
 * @see https://x402.org
 * @see https://eips.ethereum.org/EIPS/eip-3009
 */

import {
  createWalletClient,
  parseAbi,
  parseUnits,
  getAddress,
  hexToBytes,
  recoverTypedDataAddress,
  type Hex,
  type Address,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { z } from 'zod';
import { CHAIN, CHAIN_ID, walletTransport, getSettlementToken, publicClient } from './chain';

const TRANSFER_WITH_AUTH_ABI = parseAbi([
  'function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s)',
  'function authorizationState(address authorizer, bytes32 nonce) view returns (bool)',
]);

const HEX_BYTES32 = /^0x[a-fA-F0-9]{64}$/;
const HEX_ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const HEX_SIGNATURE = /^0x[a-fA-F0-9]{130}$/;

// Schema for the X-PAYMENT request payload (per x402 spec)
const x402PaymentSchema = z.object({
  x402Version: z.number().int().min(1).max(1),
  scheme: z.literal('exact'),
  network: z.string(),
  payload: z.object({
    signature: z.string().regex(HEX_SIGNATURE, 'invalid signature format (expect 132-char hex)'),
    authorization: z.object({
      from: z.string().regex(HEX_ADDRESS),
      to: z.string().regex(HEX_ADDRESS),
      value: z.string().regex(/^\d+$/, 'value must be a base-units integer string'),
      validAfter: z.string().regex(/^\d+$/),
      validBefore: z.string().regex(/^\d+$/),
      nonce: z.string().regex(HEX_BYTES32),
    }),
  }),
});

export type X402PaymentPayload = z.infer<typeof x402PaymentSchema>;

export interface SettlementResult {
  ok: boolean;
  txHash?: Hex;
  payer?: Address;
  blockNumber?: number;
  errorReason?: string;
}

export interface PaywallExpectation {
  paywallId: string;
  /** USD price as a string, e.g. "0.01" */
  priceUsd: string;
  /** Merchant payout address — must match `authorization.to` */
  payTo: Address;
}

/**
 * Decode the X-PAYMENT request header and validate its shape against the
 * x402 spec. Returns null if header missing/malformed.
 */
export function decodeX402PaymentHeader(req: Request): X402PaymentPayload | null {
  const header = req.headers.get('x-payment') || req.headers.get('X-PAYMENT');
  if (!header || header.length > 32_768) return null;
  try {
    const json = Buffer.from(header, 'base64').toString('utf-8');
    const parsed = JSON.parse(json);
    const result = x402PaymentSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/**
 * Encode a server-side X-PAYMENT-RESPONSE header value (base64 JSON).
 */
export function encodeX402ResponseHeader(payload: {
  success: boolean;
  transaction?: string;
  network?: string;
  payer?: string;
  errorReason?: string | null;
}): string {
  return Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64');
}

/**
 * Settle an x402 payment by submitting the signed EIP-3009 authorization
 * on-chain via the operator wallet.
 *
 * Validates that the authorization matches the paywall's requirements before
 * spending gas (cheap rejections of malformed/wrong-amount payloads).
 */
export async function settleX402Payment(
  payment: X402PaymentPayload,
  expectation: PaywallExpectation,
): Promise<SettlementResult> {
  const operatorKey = process.env.COMMERCE_PAYMENTS_OPERATOR_KEY || process.env.OPERATOR_PRIVATE_KEY;
  if (!operatorKey) {
    return { ok: false, errorReason: 'operator wallet not configured' };
  }

  const token = getSettlementToken();
  const expectedTo = getAddress(expectation.payTo);
  const expectedAmountRaw = parseUnits(expectation.priceUsd, token.decimals);

  // ─── Pre-chain validation (avoid wasting gas on bad payloads) ─────────────
  const auth = payment.payload.authorization;

  // 1. Network must match
  const expectedNetwork = `eip155:${CHAIN_ID}`;
  if (payment.network !== expectedNetwork && payment.network !== `base${CHAIN.testnet ? '-sepolia' : ''}`) {
    return { ok: false, errorReason: `wrong network: expected ${expectedNetwork}, got ${payment.network}` };
  }

  // 2. Recipient must match the paywall's payout address
  let to: Address;
  try {
    to = getAddress(auth.to);
  } catch {
    return { ok: false, errorReason: 'invalid `to` address' };
  }
  if (to.toLowerCase() !== expectedTo.toLowerCase()) {
    return { ok: false, errorReason: `wrong recipient: expected ${expectedTo}, got ${to}` };
  }

  // 3. Amount must cover the paywall price (exact or more — agents can over-pay)
  const valueRaw = BigInt(auth.value);
  if (valueRaw < expectedAmountRaw) {
    return {
      ok: false,
      errorReason: `insufficient amount: expected ${expectation.priceUsd} ${token.symbol} (${expectedAmountRaw} base units), got ${auth.value}`,
    };
  }

  // 4. Validity window must include now
  const now = BigInt(Math.floor(Date.now() / 1000));
  const validAfter = BigInt(auth.validAfter);
  const validBefore = BigInt(auth.validBefore);
  if (now < validAfter || now > validBefore) {
    return {
      ok: false,
      errorReason: `authorization expired or not yet valid (now=${now}, validAfter=${validAfter}, validBefore=${validBefore})`,
    };
  }

  // 5. Validate from address
  let from: Address;
  try {
    from = getAddress(auth.from);
  } catch {
    return { ok: false, errorReason: 'invalid `from` address' };
  }

  // 6. Check nonce hasn't already been used (cheap on-chain read)
  try {
    const used = await publicClient.readContract({
      address: token.address,
      abi: TRANSFER_WITH_AUTH_ABI,
      functionName: 'authorizationState',
      args: [from, auth.nonce as Hex],
    });
    if (used) {
      return { ok: false, errorReason: 'nonce already used' };
    }
  } catch {
    // authorizationState() not available on this token — proceed anyway
  }

  // ─── Split signature into v/r/s ────────────────────────────────────────────
  const sig = payment.payload.signature;
  const sigBytes = hexToBytes(sig as Hex);
  if (sigBytes.length !== 65) {
    return { ok: false, errorReason: 'signature must be 65 bytes' };
  }
  const r = (`0x${sig.slice(2, 66)}`) as Hex;
  const s = (`0x${sig.slice(66, 130)}`) as Hex;
  let v = parseInt(sig.slice(130, 132), 16);
  if (v < 27) v += 27;

  // ─── Verify signature off-chain BEFORE on-chain submission ─────────────────
  // Defense against gas-DoS: a botnet can spam well-formed-but-invalid signatures
  // to force the operator to broadcast reverting transactions. Recovering the
  // signer locally (no RPC) lets us reject every invalid signature for ~1ms of
  // ECDSA work and zero gas. We compare against `auth.from` (already validated
  // as a checksummed address). The EIP-712 domain MUST match what the wallet
  // signed: the USDC token's name/version/chainId/verifyingContract.
  try {
    const recovered = await recoverTypedDataAddress({
      domain: {
        name: (token as { name?: string }).name ?? 'USD Coin',
        version: '2', // USDC's EIP-712 domain version is '2'; if Coal adds non-USDC tokens, parameterize this.
        chainId: CHAIN_ID,
        verifyingContract: token.address,
      },
      types: {
        TransferWithAuthorization: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'validAfter', type: 'uint256' },
          { name: 'validBefore', type: 'uint256' },
          { name: 'nonce', type: 'bytes32' },
        ],
      },
      primaryType: 'TransferWithAuthorization',
      message: {
        from,
        to,
        value: valueRaw,
        validAfter,
        validBefore,
        nonce: auth.nonce as Hex,
      },
      signature: sig as Hex,
    });
    if (recovered.toLowerCase() !== from.toLowerCase()) {
      return {
        ok: false,
        errorReason: `invalid signature: recovered ${recovered}, expected ${from}`,
      };
    }
  } catch (err) {
    return {
      ok: false,
      errorReason: `signature recovery failed: ${err instanceof Error ? err.message : 'unknown'}`,
    };
  }

  // ─── Submit on-chain ──────────────────────────────────────────────────────
  const operator = privateKeyToAccount(operatorKey.startsWith('0x') ? operatorKey as Hex : (`0x${operatorKey}`) as Hex);
  const operatorClient = createWalletClient({
    chain: CHAIN,
    transport: walletTransport,
    account: operator,
  });

  let txHash: Hex;
  try {
    txHash = await operatorClient.writeContract({
      address: token.address,
      abi: TRANSFER_WITH_AUTH_ABI,
      functionName: 'transferWithAuthorization',
      args: [
        from,
        to,
        valueRaw,
        validAfter,
        validBefore,
        auth.nonce as Hex,
        v,
        r,
        s,
      ],
    });
  } catch (err) {
    return { ok: false, errorReason: err instanceof Error ? err.message : 'on-chain submission failed' };
  }

  // Wait for inclusion
  try {
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
      timeout: 30_000,
    });
    if (receipt.status !== 'success') {
      return { ok: false, txHash, errorReason: 'tx reverted' };
    }
    return {
      ok: true,
      txHash,
      payer: from,
      blockNumber: Number(receipt.blockNumber),
    };
  } catch (err) {
    return { ok: false, txHash, errorReason: err instanceof Error ? err.message : 'tx confirmation timed out' };
  }
}
