import { NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { errors, apiSuccess } from '@/lib/errors';
import { rateLimiters, checkRateLimit, getIP } from '@/lib/rate-limit';
import { getPaywallVerificationState } from '@/lib/paywall-verification';
import { buildX402Headers, buildDualProtocolBody } from '@/lib/x402';
import { decodeX402PaymentHeader, encodeX402ResponseHeader, settleX402Payment } from '@/lib/x402-settle';
import { decodeAppPaymentHeader, encodeAppResponseHeader, peekPaymentVersion, settleAppPayment } from '@/lib/app-settle';
import { EXPLORER_URL, getSettlementToken } from '@/lib/chain';
import { createHash } from 'crypto';
import type { Address } from 'viem';

// H1: Validate paywall ID format before DB query.
// Accepts either DB-generated cuid-style IDs (lowercase a-z0-9, 20-36 chars)
// or static slug-style IDs prefixed with `pw_` (e.g. `pw_oracle_price_feed`).
const VALID_ID_PATTERN = /^([a-z0-9]{20,36}|pw_[a-z0-9_]{3,60})$/;
// H2: Validate EVM address format
const VALID_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const ip = getIP(request);
        const { limited, headers: rlHeaders } = await checkRateLimit(rateLimiters.public, ip);
        if (limited) return errors.rateLimited();

        const { id } = await params;

        if (!VALID_ID_PATTERN.test(id)) {
            return errors.notFound('Paywall');
        }

        const url = new URL(request.url);
        const rawAddress = url.searchParams.get('address');
        const address = rawAddress && VALID_ADDRESS_PATTERN.test(rawAddress) ? rawAddress : undefined;

        const verification = await getPaywallVerificationState({ paywallId: id, address });
        if (!verification) return errors.notFound('Paywall');

        if (verification.paid) {
            // For per_call paywalls, atomically check quota AND increment count.
            // This prevents the race where N concurrent requests all read the same
            // accessCount and slip through the quota check.
            if (verification.paywall.pricingModel === 'per_call' && address) {
                const quota = verification.paywall.callQuota;
                if (quota) {
                    const result = await prisma.$executeRawUnsafe(
                        `UPDATE "paywall_access" SET "accessCount" = "accessCount" + 1, "lastAccessAt" = NOW() WHERE "paywallId" = $1 AND "address" = $2 AND "accessCount" < $3`,
                        id,
                        address.toLowerCase(),
                        quota,
                    );
                    // If no row was updated, the quota has been reached
                    if (result === 0) {
                        // Re-fetch verification to return the quota-exceeded response
                        const refreshed = await getPaywallVerificationState({ paywallId: id, address });
                        if (refreshed && !refreshed.paid) {
                            const x402Headers = buildX402Headers({
                                id: refreshed.paywall.id,
                                price: refreshed.paywall.price,
                                currency: refreshed.paywall.currency,
                                name: refreshed.paywall.name,
                                description: refreshed.paywall.description,
                                merchant: refreshed.paywall.merchant,
                            });
                            const dualBody = buildDualProtocolBody(
                                {
                                    id: refreshed.paywall.id,
                                    price: refreshed.paywall.price,
                                    currency: refreshed.paywall.currency,
                                    name: refreshed.paywall.name,
                                    description: refreshed.paywall.description,
                                    merchant: refreshed.paywall.merchant,
                                },
                                refreshed.body as Record<string, unknown>,
                            );
                            return NextResponse.json(dualBody, { status: 402, headers: x402Headers });
                        }
                    }
                } else {
                    // No quota set — increment normally
                    await prisma.paywallAccess.update({
                        where: { paywallId_address: { paywallId: id, address: address.toLowerCase() } },
                        data: { accessCount: { increment: 1 }, lastAccessAt: new Date() },
                    }).catch(() => null);
                }
            }
            return apiSuccess(verification.body, 200);
        }

        // Build dual-protocol response: x402 v1 headers (legacy clients) +
        // a v2 body that lists both x402 and APP `accepts[]` so any agent picks.
        const x402Headers = buildX402Headers({
            id: verification.paywall.id,
            price: verification.paywall.price,
            currency: verification.paywall.currency,
            name: verification.paywall.name,
            description: verification.paywall.description,
            merchant: verification.paywall.merchant,
        });

        const dualBody = buildDualProtocolBody(
            {
                id: verification.paywall.id,
                price: verification.paywall.price,
                currency: verification.paywall.currency,
                name: verification.paywall.name,
                description: verification.paywall.description,
                merchant: verification.paywall.merchant,
            },
            verification.body as Record<string, unknown>,
        );

        return NextResponse.json(dualBody, {
            status: 402,
            headers: {
                ...rlHeaders,
                ...x402Headers,
            },
        });
    } catch {
        return errors.internal();
    }
}

/**
 * POST /api/paywalls/[id]/verify
 *
 * x402 payment settlement endpoint. Per the x402 protocol, an agent that has
 * received a 402 from the GET handler may retry by POSTing here with an
 * `X-PAYMENT` header containing a base64-encoded EIP-3009 signed authorization.
 *
 * Coal acts as the facilitator: validates the signed authorization against the
 * paywall's requirements, submits `transferWithAuthorization` on-chain via the
 * operator wallet (gasless for the agent), records the payment, and returns
 * 200 + content with an `X-PAYMENT-RESPONSE` header containing the tx hash.
 *
 * @see https://x402.org
 */
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const ip = getIP(request);
        const { limited, headers: rlHeaders } = await checkRateLimit(rateLimiters.public, ip);
        if (limited) return errors.rateLimited();

        const { id } = await params;
        if (!VALID_ID_PATTERN.test(id)) return errors.notFound('Paywall');

        // Detect protocol version: v1 = x402 (Coinbase), v2 = APP (OKX). Same
        // wire envelope, same EIP-3009 signature, but APP wraps the auth in an
        // `accepted{}` block instead of v1's flat `scheme/network/payload`.
        const protocolVersion = peekPaymentVersion(request);
        const isAppV2 = protocolVersion === 2;

        // Decode the X-PAYMENT header into either v1 or v2 shape.
        const x402Payment = isAppV2 ? null : decodeX402PaymentHeader(request);
        const appPayment = isAppV2 ? decodeAppPaymentHeader(request) : null;

        if (!x402Payment && !appPayment) {
            return NextResponse.json(
                { error: 'X-PAYMENT header missing or malformed', hint: 'Expected base64(JSON) with x402Version 1 (x402) or 2 (APP).' },
                { status: 400 },
            );
        }

        // Common fields extracted from whichever envelope was provided.
        const payer = (x402Payment?.payload.authorization.from
            ?? appPayment?.payload.authorization.from) as Address;
        const paymentNetwork = x402Payment?.network ?? appPayment?.accepted.network ?? 'unknown';

        // Look up paywall + check whether already paid (idempotency)
        const verification = await getPaywallVerificationState({ paywallId: id, address: payer });
        if (!verification) return errors.notFound('Paywall');

        const paywall = verification.paywall;
        const isPerCall = paywall.pricingModel === 'per_call';

        // Idempotency for one_time paywalls only: if the wallet has already paid,
        // short-circuit to avoid double-charging. Per_call paywalls always settle
        // a new on-chain authorization (the on-chain authorizationState() nonce check
        // prevents replaying the SAME signed authorization).
        if (verification.paid && !isPerCall) {
            const xPaymentResponse = isAppV2
                ? encodeAppResponseHeader({
                    success: true,
                    status: 'success',
                    network: paymentNetwork,
                    payer,
                    errorReason: null,
                })
                : encodeX402ResponseHeader({
                    success: true,
                    network: paymentNetwork,
                    payer,
                    errorReason: null,
                });
            return NextResponse.json(verification.body, {
                status: 200,
                headers: {
                    ...rlHeaders,
                    'X-PAYMENT-RESPONSE': xPaymentResponse,
                },
            });
        }
        if (!paywall.merchant.payoutAddress) {
            return NextResponse.json(
                { error: 'Paywall has no payout address configured' },
                { status: 400 },
            );
        }

        // Settle on-chain. Both v1 (x402) and v2 (APP) flow through the same
        // EIP-3009 transferWithAuthorization on Base — APP just reshapes the
        // payload before delegating.
        const expectation = {
            paywallId: paywall.id,
            priceUsd: paywall.price.toString(),
            payTo: paywall.merchant.payoutAddress as Address,
        };
        const result = isAppV2 && appPayment
            ? await settleAppPayment(appPayment, expectation)
            : await settleX402Payment(x402Payment!, expectation);

        if (!result.ok || !result.txHash) {
            // Per x402 spec, return 402 again with the same payment requirements
            const x402Headers = buildX402Headers({
                id: paywall.id,
                price: paywall.price,
                currency: paywall.currency,
                name: paywall.name,
                description: paywall.description,
                merchant: paywall.merchant,
            });
            const failureResponse = isAppV2
                ? encodeAppResponseHeader({
                    success: false,
                    status: 'failed',
                    errorReason: result.errorReason || 'unknown',
                })
                : encodeX402ResponseHeader({
                    success: false,
                    errorReason: result.errorReason || 'unknown',
                });
            return NextResponse.json(
                { error: 'Payment failed', reason: result.errorReason || 'unknown' },
                {
                    status: 402,
                    headers: {
                        ...rlHeaders,
                        ...x402Headers,
                        'X-PAYMENT-RESPONSE': failureResponse,
                    },
                },
            );
        }

        // Record payment in Coal's DB so future GET /verify returns paid
        const token = getSettlementToken();
        const checkoutId = createHash('sha256')
            .update(`x402:${paywall.id}:${result.txHash}`)
            .digest('hex')
            .slice(0, 24);

        // Create a synthetic checkout session + transaction so existing receipt
        // infrastructure works for x402 payments too
        await prisma.$transaction(async (tx) => {
            const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
            const session = await tx.checkoutSession.upsert({
                where: { id: checkoutId },
                update: {},
                create: {
                    id: checkoutId,
                    merchantId: paywall.merchantId,
                    productId: null,
                    amount: paywall.price,
                    currency: paywall.currency,
                    status: 'confirmed',
                    txHash: result.txHash!,
                    expiresAt,
                    customerAddress: payer.toLowerCase(),
                    metadata: {
                        x402: !isAppV2,
                        app: isAppV2,
                        protocolVersion: isAppV2 ? 2 : 1,
                        paywallId: paywall.id,
                        payerAddress: payer.toLowerCase(),
                        snapshotPayoutAddress: paywall.merchant.payoutAddress,
                        network: paymentNetwork,
                        scheme: isAppV2 ? appPayment?.accepted.scheme : 'exact',
                    } as Prisma.InputJsonValue,
                },
            });

            await tx.transaction.upsert({
                where: { txHash: result.txHash! },
                update: {},
                create: {
                    checkoutId: session.id,
                    txHash: result.txHash!,
                    from: payer,
                    to: paywall.merchant.payoutAddress!,
                    amount: paywall.price.toString(),
                    token: token.symbol,
                    status: 'confirmed',
                    blockNumber: result.blockNumber || 0,
                },
            });

            // Grant paywall access
            const accessExpiresAt = paywall.accessDuration
                ? new Date(Date.now() + paywall.accessDuration * 1000)
                : null;
            await tx.paywallAccess.upsert({
                where: {
                    paywallId_address: {
                        paywallId: paywall.id,
                        address: payer.toLowerCase(),
                    },
                },
                update: {
                    accessCount: { increment: 1 },
                    txHash: result.txHash!,
                    revokedAt: null,
                    revokedReason: null,
                    ...(accessExpiresAt && { expiresAt: accessExpiresAt }),
                },
                create: {
                    paywallId: paywall.id,
                    address: payer.toLowerCase(),
                    txHash: result.txHash!,
                    accessCount: 1,
                    expiresAt: accessExpiresAt,
                },
            });
        });

        // Re-fetch state and return success
        const finalState = await getPaywallVerificationState({ paywallId: id, address: payer });
        const successResponse = isAppV2
            ? encodeAppResponseHeader({
                success: true,
                status: 'success',
                transaction: result.txHash,
                network: paymentNetwork,
                payer,
                errorReason: null,
            })
            : encodeX402ResponseHeader({
                success: true,
                transaction: result.txHash,
                network: paymentNetwork,
                payer,
                errorReason: null,
            });
        return NextResponse.json(finalState?.body ?? { paid: true, txHash: result.txHash }, {
            status: 200,
            headers: {
                ...rlHeaders,
                'X-PAYMENT-RESPONSE': successResponse,
                'X-Payment-Tx-Hash': result.txHash,
                'X-Payment-Explorer': `${EXPLORER_URL}/tx/${result.txHash}`,
                'X-Payment-Protocol': isAppV2 ? 'app-v2' : 'x402-v1',
            },
        });
    } catch (err) {
        console.error('[x402 settle] unexpected error', err);
        return errors.internal();
    }
}
