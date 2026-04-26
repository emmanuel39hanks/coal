import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getIP, checkRateLimit, rateLimiters } from '@/lib/rate-limit';

export async function GET(request: Request) {
    const ip = getIP(request);
    const { limited } = await checkRateLimit(rateLimiters.public, ip);
    if (limited) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '10', 10), 50);

    const links = await prisma.paymentLink.findMany({
        where: { active: true, product: { active: true } },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
            id: true,
            slug: true,
            title: true,
            description: true,
            product: {
                select: { name: true, description: true, price: true, image: true },
            },
            merchant: {
                select: { name: true, payoutAddress: true },
            },
        },
    });

    const products = links
        .filter(l => l.product && l.merchant.payoutAddress)
        .map(l => ({
            linkId: l.id,
            linkSlug: l.slug,
            name: l.product!.name,
            description: l.product!.description,
            price: l.product!.price.toString(),
            image: l.product!.image,
            merchantName: l.merchant.name,
            payoutAddress: l.merchant.payoutAddress,
        }));

    return NextResponse.json({ products });
}
