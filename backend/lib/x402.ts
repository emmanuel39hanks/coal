/**
 * x402 Payment Protocol helpers for Coal paywalls.
 *
 * Implements the server-side of the x402 protocol (HTTP 402 Payment Required)
 * so that AI agents and x402-compatible clients can discover, negotiate,
 * and pay for Coal paywall-protected resources automatically.
 *
 * @see https://x402.org
 * @see https://github.com/coinbase/x402
 */

import { z } from 'zod';
import { CHAIN_ID, getSettlementToken } from '@/lib/chain';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.usecoal.xyz';

// CAIP-2 chain identifier for Base (or Base Sepolia)
function getCAIP2ChainId(): string {
    return `eip155:${CHAIN_ID}`;
}

/**
 * Build x402 PaymentRequirements for a paywall.
 *
 * This is the payload that goes into the `X-PAYMENT` response header
 * when a 402 is returned. x402-compatible clients parse this to know
 * how to pay.
 */
export function buildPaymentRequirements(paywall: {
    id: string;
    price: { toString(): string };
    currency: string;
    name: string;
    description?: string | null;
    merchant: { payoutAddress: string | null };
}) {
    const token = getSettlementToken();
    const recipient = paywall.merchant.payoutAddress;

    if (!recipient) {
        return null;
    }

    // Format price as dollar string for x402 (e.g. "$1.50")
    const priceStr = `$${paywall.price.toString()}`;

    return {
        scheme: 'exact' as const,
        network: getCAIP2ChainId(),
        maxAmountRequired: priceStr,
        resource: `${API_BASE_URL}/api/paywalls/${paywall.id}/verify`,
        description: paywall.name,
        mimeType: 'application/json',
        payTo: recipient,
        maxTimeoutSeconds: 900, // 15 min
        asset: token.address,
        extra: {
            // Coal-specific fields agents can use
            coalPaywallId: paywall.id,
            coalPayUrl: `${API_BASE_URL}/api/paywalls/${paywall.id}/pay`,
            coalPayIntentUrl: `${API_BASE_URL}/api/agent/paywalls/${paywall.id}/pay-intent`,
            coalManifestUrl: `${API_BASE_URL}/api/agent/paywalls/${paywall.id}/manifest`,
            coalReceiptVerifyTemplate: `${API_BASE_URL}/api/agent/receipts/{checkoutId}/verify`,
            currency: paywall.currency,
            tokenSymbol: token.symbol,
            tokenDecimals: token.decimals,
        },
    };
}

/**
 * Encode payment requirements as a base64 JSON string for the
 * X-PAYMENT response header (x402 spec).
 */
export function encodePaymentHeader(requirements: ReturnType<typeof buildPaymentRequirements>): string {
    if (!requirements) return '';
    return Buffer.from(JSON.stringify(requirements), 'utf-8').toString('base64');
}

/**
 * Build the full set of x402 response headers for a 402 response.
 */
export function buildX402Headers(paywall: {
    id: string;
    price: { toString(): string };
    currency: string;
    name: string;
    description?: string | null;
    merchant: { payoutAddress: string | null };
}): Record<string, string> {
    const requirements = buildPaymentRequirements(paywall);
    if (!requirements) {
        return {
            'X-Payment-Required': 'true',
        };
    }

    const encoded = encodePaymentHeader(requirements);
    return {
        'X-Payment-Required': 'true',
        'X-PAYMENT': encoded,
        'X-Payment-Protocols': 'x402-v1, app-v2',
        'Access-Control-Expose-Headers': 'X-PAYMENT, X-Payment-Required, X-Payment-Protocols',
    };
}

/**
 * Build a dual-protocol PaymentRequired response body that lists both
 * Coinbase x402 (v1) and OKX APP (v2) options in a single `accepts[]` array.
 *
 * Per the OKX APP whitepaper + the okx/payments SDK, APP and x402 share the
 * same wire format and the same EIP-3009 signature on Base USDC. The only
 * differences:
 *   1. v2 wraps the auth in an `accepted{}` block with `amount` in base units
 *      (not "$X.YY"), while v1 uses `maxAmountRequired` as a dollar string.
 *   2. v2 supports the `aggr_deferred` scheme for batched / deferred settlement.
 *
 * Coal advertises BOTH so any agent — Coinbase x402-native, OKX APP-native, or
 * a future v2 client — can pay the same paywall. This is the multi-protocol
 * compatibility play.
 */
export function buildDualProtocolBody(paywall: {
    id: string;
    price: { toString(): string };
    currency: string;
    name: string;
    description?: string | null;
    merchant: { payoutAddress: string | null };
}, base: Record<string, unknown>) {
    const token = getSettlementToken();
    const recipient = paywall.merchant.payoutAddress;
    if (!recipient) return base;

    const priceUsd = paywall.price.toString();
    const priceBaseUnits = Math.round(Number(priceUsd) * 10 ** token.decimals).toString();
    const network = getCAIP2ChainId();
    const verifyUrl = `${API_BASE_URL}/api/paywalls/${paywall.id}/verify`;

    // v2 / APP-flavored accepts entries — emit alongside v1 so any client picks one.
    const acceptsV2 = [
        {
            scheme: 'exact',
            network,
            asset: token.address,
            amount: priceBaseUnits,
            payTo: recipient,
            resource: verifyUrl,
            description: paywall.name,
            mimeType: 'application/json',
            maxTimeoutSeconds: 900,
            extra: {
                name: token.symbol === 'USDC' ? 'USD Coin' : token.symbol,
                version: '2',
            },
        },
        {
            scheme: 'aggr_deferred',
            network,
            asset: token.address,
            amount: priceBaseUnits,
            payTo: recipient,
            resource: verifyUrl,
            description: paywall.name,
            mimeType: 'application/json',
            maxTimeoutSeconds: 900,
        },
    ];

    return {
        ...base,
        // v2 envelope so APP-native agents can parse it natively
        x402Version: 2,
        protocols: ['x402-v1', 'app-v2'],
        accepts: acceptsV2,
    };
}

// H3: Schema for validating decoded x402 payment payloads
const x402PayloadSchema = z.object({
    scheme: z.string(),
    network: z.string(),
    maxAmountRequired: z.string(),
    resource: z.string(),
    payTo: z.string(),
    asset: z.string(),
    description: z.string().optional(),
    mimeType: z.string().optional(),
    maxTimeoutSeconds: z.number().optional(),
    extra: z.record(z.string(), z.unknown()).optional(),
}).passthrough();

/**
 * Decode an x402 payment payload from the X-PAYMENT request header.
 * Returns null if the header is missing, malformed, or fails schema validation.
 */
export function decodePaymentPayload(request: Request): z.infer<typeof x402PayloadSchema> | null {
    const header = request.headers.get('X-PAYMENT') || request.headers.get('x-payment');
    if (!header || header.length > 16_384) return null; // reject oversized headers

    try {
        const decoded = Buffer.from(header, 'base64').toString('utf-8');
        const parsed = JSON.parse(decoded);

        // Reject non-objects and arrays
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

        const result = x402PayloadSchema.safeParse(parsed);
        return result.success ? result.data : null;
    } catch {
        return null;
    }
}
