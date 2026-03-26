import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { validateApiKey } from '@/lib/api-auth';
import { errors, apiSuccess } from '@/lib/errors';
import { checkRateLimit, rateLimiters } from '@/lib/rate-limit';
import { validateBody } from '@/lib/schemas';
import { getPaywallVerificationState } from '@/lib/paywall-verification';

const FRONTEND_URL = process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000';
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const payIntentSchema = z.object({
    redirectUrl: z.string().url().optional().or(z.literal('')),
    callbackUrl: z.string().url().optional().or(z.literal('')),
    metadata: z.record(z.string(), z.unknown()).optional(),
    subject: z
        .object({
            walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
            did: z.string().min(3).max(255).optional(),
            agentId: z.string().min(1).max(255).optional(),
        })
        .optional(),
});

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const keyRecord = await validateApiKey(request);
        if (!keyRecord) return errors.unauthorized('Invalid or missing API Key');

        const { limited } = await checkRateLimit(rateLimiters.checkout, keyRecord.id);
        if (limited) return errors.rateLimited();

        const { id } = await params;
        const paywall = await prisma.paywall.findUnique({
            where: { id },
            select: {
                id: true,
                merchantId: true,
                name: true,
                description: true,
                price: true,
                currency: true,
                contentType: true,
                pricingModel: true,
                active: true,
            },
        });

        if (!paywall || paywall.merchantId !== keyRecord.merchant.id || !paywall.active) {
            return errors.notFound('Paywall');
        }

        const body = await request.json().catch(() => ({}));
        const validated = validateBody(payIntentSchema, body);
        if (!validated.success) return validated.error;

        const session = await prisma.checkoutSession.create({
            data: {
                merchantId: keyRecord.merchant.id,
                amount: paywall.price,
                currency: paywall.currency,
                description: paywall.name,
                redirectUrl: validated.data.redirectUrl || null,
                callbackUrl: validated.data.callbackUrl || null,
                metadata: {
                    paywallId: paywall.id,
                    pricingModel: paywall.pricingModel,
                    contentType: paywall.contentType,
                    ...(validated.data.subject?.walletAddress ? { payerAddress: validated.data.subject.walletAddress.toLowerCase() } : {}),
                    ...(validated.data.subject?.did ? { payerDid: validated.data.subject.did } : {}),
                    ...(validated.data.subject?.agentId ? { agentId: validated.data.subject.agentId } : {}),
                    ...(validated.data.metadata ?? {}),
                },
                expiresAt: new Date(Date.now() + 30 * 60 * 1000),
            },
        });

        const verification = await getPaywallVerificationState({
            paywallId: paywall.id,
            address: validated.data.subject?.walletAddress,
            did: validated.data.subject?.did,
            agentId: validated.data.subject?.agentId,
        });

        return apiSuccess(
            {
                checkoutId: session.id,
                paywallId: paywall.id,
                status: session.status,
                amount: session.amount,
                currency: session.currency,
                description: paywall.description,
                paymentUrl: `${FRONTEND_URL}/pay/checkout/${session.id}`,
                verifyUrl: `${API_BASE_URL}/api/agent/paywalls/${paywall.id}/verify`,
                receiptVerifyUrlTemplate: `${API_BASE_URL}/api/agent/receipts/{checkoutId}/verify`,
                expiresAt: session.expiresAt,
                zeroG: verification?.body.zeroG ?? {
                    manifestPublished: false,
                    manifestUri: null,
                    manifestRoot: null,
                    manifestPayloadHash: null,
                },
            },
            201,
        );
    } catch {
        return errors.internal();
    }
}
