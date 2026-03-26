import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { errors, apiSuccess } from '@/lib/errors';
import { rateLimiters, checkRateLimit, getIP } from '@/lib/rate-limit';
import { getPaywallVerificationState } from '@/lib/paywall-verification';
import { buildX402Headers } from '@/lib/x402';

// H1: Validate paywall ID format before DB query
const VALID_ID_PATTERN = /^[a-z0-9]{20,36}$/;
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
                            return NextResponse.json(refreshed.body, { status: 402, headers: x402Headers });
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

        // Build x402-compliant headers so AI agents and x402 clients
        // can automatically discover payment requirements
        const x402Headers = buildX402Headers({
            id: verification.paywall.id,
            price: verification.paywall.price,
            currency: verification.paywall.currency,
            name: verification.paywall.name,
            description: verification.paywall.description,
            merchant: verification.paywall.merchant,
        });

        return NextResponse.json(verification.body, {
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
