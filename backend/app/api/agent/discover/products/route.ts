import { prisma } from '@/lib/prisma';
import { errors, apiSuccess } from '@/lib/errors';
import { getIP, checkRateLimit, rateLimiters } from '@/lib/rate-limit';

export async function GET(request: Request) {
    const ip = getIP(request);
    const { limited } = await checkRateLimit(rateLimiters.public, ip);
    if (limited) return errors.rateLimited();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const maxPrice = searchParams.get('maxPrice');
    const tag = searchParams.get('tag');

    const where: Record<string, unknown> = {
        active: true,
        merchant: { onboardingComplete: true },
    };

    if (search) {
        where.name = { contains: search, mode: 'insensitive' };
    }
    if (maxPrice) {
        where.price = { lte: parseFloat(maxPrice) };
    }
    if (tag) {
        where.tags = { has: tag };
    }

    const products = await prisma.product.findMany({
        where,
        select: {
            id: true,
            name: true,
            description: true,
            price: true,
            image: true,
            tags: true,
            merchantId: true,
            merchant: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
    });

    return apiSuccess({
        products: products.map(p => ({
            id: p.id,
            name: p.name,
            description: p.description,
            price: p.price.toString(),
            image: p.image,
            tags: p.tags,
            merchantId: p.merchantId,
            merchantName: p.merchant.name,
        })),
        total: products.length,
    });
}
