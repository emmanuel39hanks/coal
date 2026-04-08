import { prisma } from '@/lib/prisma';
import { errors, apiSuccess } from '@/lib/errors';
import { getIP, checkRateLimit, rateLimiters } from '@/lib/rate-limit';

export async function GET(request: Request) {
    const ip = getIP(request);
    const { limited } = await checkRateLimit(rateLimiters.public, ip);
    if (limited) return errors.rateLimited();

    const apiBase = new URL(request.url).origin;

    const paywalls = await prisma.paywall.findMany({
        where: {
            active: true,
            merchant: { onboardingComplete: true },
        },
        select: {
            id: true,
            name: true,
            description: true,
            price: true,
            currency: true,
            pricingModel: true,
            contentType: true,
            accessDuration: true,
            callQuota: true,
            merchantId: true,
            merchant: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
    });

    return apiSuccess({
        paywalls: paywalls.map(pw => ({
            id: pw.id,
            name: pw.name,
            description: pw.description,
            price: pw.price.toString(),
            currency: pw.currency,
            pricingModel: pw.pricingModel,
            contentType: pw.contentType,
            accessDuration: pw.accessDuration,
            callQuota: pw.callQuota,
            merchantId: pw.merchantId,
            merchantName: pw.merchant.name,
            verifyUrl: `${apiBase}/api/paywalls/${pw.id}/verify`,
        })),
        total: paywalls.length,
    });
}
