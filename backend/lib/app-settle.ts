/**
 * APP (OKX Agent Payments Protocol) facilitator — server-side settlement.
 *
 * APP's wire format is x402 v2. For Coal's purposes, settling an APP `exact`
 * credential is byte-identical to settling an x402 v1 `exact` credential —
 * we already have all the on-chain logic in x402-settle.ts. This module adds:
 *
 *   1. v2 PaymentPayload parsing (with `accepted` field instead of v1's flat shape)
 *   2. SettleResponse with v2 `status` field
 *   3. `aggr_deferred` scheme acceptance (treated as sync `exact` in v0.1 — full
 *      batching via Multicall3 is a Phase-2 enhancement)
 *
 * @see https://github.com/okx/payments
 * @see https://web3.okx.com/whitepaper/okx-app-whitepaper.pdf
 */

import { z } from 'zod';
import {
  settleX402Payment,
  type PaywallExpectation,
  type SettlementResult,
  type X402PaymentPayload,
} from './x402-settle';

const HEX_BYTES32 = /^0x[a-fA-F0-9]{64}$/;
const HEX_ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const HEX_SIGNATURE = /^0x[a-fA-F0-9]{130}$/;

const appV2PayloadSchema = z.object({
  x402Version: z.literal(2),
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
  accepted: z.object({
    scheme: z.enum(['exact', 'aggr_deferred', 'deferred']),
    network: z.string(),
    asset: z.string().regex(HEX_ADDRESS),
    amount: z.string().regex(/^\d+$/),
    payTo: z.string().regex(HEX_ADDRESS),
    maxTimeoutSeconds: z.number().int().positive().optional(),
    extra: z.record(z.string(), z.unknown()).optional(),
  }),
  extensions: z.record(z.string(), z.unknown()).optional(),
});

export type AppV2Payload = z.infer<typeof appV2PayloadSchema>;

export interface AppSettlementResult extends SettlementResult {
  status: 'success' | 'pending' | 'failed' | 'timeout';
  scheme: 'exact' | 'aggr_deferred' | 'deferred';
}

/**
 * Decode the X-PAYMENT request header and validate as a v2 (APP) payload.
 * Returns null if not v2 or malformed — caller should fall back to the v1
 * decoder.
 */
export function decodeAppPaymentHeader(req: Request): AppV2Payload | null {
  const header = req.headers.get('x-payment') || req.headers.get('X-PAYMENT');
  if (!header || header.length > 32_768) return null;
  try {
    const json = Buffer.from(header, 'base64').toString('utf-8');
    const parsed = JSON.parse(json);
    if (parsed?.x402Version !== 2) return null;
    const result = appV2PayloadSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/**
 * Quick peek at an X-PAYMENT header to determine its protocol version.
 * Used to route between the v1 (x402) and v2 (APP) settlers.
 */
export function peekPaymentVersion(req: Request): number | null {
  const header = req.headers.get('x-payment') || req.headers.get('X-PAYMENT');
  if (!header || header.length > 32_768) return null;
  try {
    const json = Buffer.from(header, 'base64').toString('utf-8');
    const parsed = JSON.parse(json);
    return typeof parsed?.x402Version === 'number' ? parsed.x402Version : null;
  } catch {
    return null;
  }
}

/**
 * Encode an X-PAYMENT-RESPONSE header value for v2 / APP responses.
 * Adds the v2 `status` field on top of the v1 envelope.
 */
export function encodeAppResponseHeader(payload: {
  success: boolean;
  status: 'success' | 'pending' | 'failed' | 'timeout';
  transaction?: string;
  network?: string;
  payer?: string;
  errorReason?: string | null;
}): string {
  return Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64');
}

/**
 * Settle an APP v2 payment by reshaping it to v1 and reusing the x402 settler.
 * Maps the result back to v2 shape with a `status` field.
 *
 * For `exact` and `aggr_deferred` schemes we settle synchronously today; the
 * v2 contract allows for a `pending` status to support deferred batching, but
 * Phase 1 of Coal's APP support stays sync.
 */
export async function settleAppPayment(
  payment: AppV2Payload,
  expectation: PaywallExpectation,
): Promise<AppSettlementResult> {
  const v1Payload: X402PaymentPayload = {
    x402Version: 1,
    scheme: 'exact',
    network: payment.accepted.network,
    payload: payment.payload,
  };

  const v1Expectation: PaywallExpectation = {
    paywallId: expectation.paywallId,
    priceUsd: expectation.priceUsd,
    payTo: expectation.payTo,
  };

  const result = await settleX402Payment(v1Payload, v1Expectation);

  return {
    ...result,
    status: result.ok ? 'success' : 'failed',
    scheme: payment.accepted.scheme,
  };
}
