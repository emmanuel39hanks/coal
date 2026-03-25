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
        'Access-Control-Expose-Headers': 'X-PAYMENT, X-Payment-Required',
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
