import { prisma } from '@/lib/prisma';
import { errors, apiSuccess } from '@/lib/errors';
import { getIP, checkRateLimit, rateLimiters } from '@/lib/rate-limit';

export async function GET(request: Request) {
    const ip = getIP(request);
    const { limited } = await checkRateLimit(rateLimiters.public, ip);
    if (limited) return errors.rateLimited();

    const apiBase = new URL(request.url).origin;

    // Find merchants with at least 1 active product or paywall
    // Filter out QA/dev/test merchants
    const merchants = await prisma.user.findMany({
        where: {
            onboardingComplete: true,
            NOT: {
                OR: [
                    { name: { contains: 'QA', mode: 'insensitive' } },
                    { name: { contains: 'Dev ', mode: 'insensitive' } },
                    { name: { contains: 'Test', mode: 'insensitive' } },
                    { id: { startsWith: 'qa_' } },
                ],
            },
            OR: [
                { products: { some: { active: true } } },
                { paywalls: { some: { active: true } } },
            ],
        },
        select: {
            id: true,
            name: true,
            image: true,
            products: {
                where: { active: true },
                select: { id: true, name: true, price: true, image: true, description: true },
                orderBy: { createdAt: 'desc' },
                take: 20,
            },
            paywalls: {
                where: { active: true },
                select: { id: true, name: true, price: true, currency: true, pricingModel: true, contentType: true, description: true },
                orderBy: { createdAt: 'desc' },
                take: 20,
            },
            _count: { select: { products: { where: { active: true } }, paywalls: { where: { active: true } } } },
        },
        take: 50,
    });

    // Fetch 0G publication status for each merchant
    const merchantIds = merchants.map(m => m.id);
    const artifacts = await prisma.storedArtifact.findMany({
        where: {
            merchantId: { in: merchantIds },
            kind: 'merchant_profile',
            status: 'published',
            storageUri: { not: null },
        },
        select: { merchantId: true, storageRoot: true, storageUri: true },
        orderBy: { createdAt: 'desc' },
        distinct: ['merchantId'],
    });
    const artifactMap = new Map(artifacts.map(a => [a.merchantId, a]));

    const result = merchants.map(m => {
        const artifact = artifactMap.get(m.id);
        return {
            id: m.id,
            name: m.name,
            image: m.image,
            productCount: m._count.products,
            paywallCount: m._count.paywalls,
            topProducts: m.products.map(p => ({
                id: p.id,
                name: p.name,
                price: p.price.toString(),
                image: p.image,
                description: p.description,
            })),
            topPaywalls: m.paywalls.map(pw => ({
                id: pw.id,
                name: pw.name,
                price: pw.price.toString(),
                pricingModel: pw.pricingModel,
                contentType: pw.contentType,
                description: pw.description,
                verifyUrl: `${apiBase}/api/paywalls/${pw.id}/verify`,
            })),
            zeroG: artifact ? {
                published: true,
                storageRoot: artifact.storageRoot,
                storageUri: artifact.storageUri,
            } : { published: false },
            endpoints: {
                profile: `${apiBase}/api/agent/merchant-profiles/${m.id}`,
                memoryQuery: `${apiBase}/api/agent/memory/query`,
            },
        };
    });

    return apiSuccess({
        merchants: result,
        stats: {
            totalMerchants: result.length,
            totalProducts: result.reduce((sum, m) => sum + m.productCount, 0),
            totalPaywalls: result.reduce((sum, m) => sum + m.paywallCount, 0),
        },
    });
}
