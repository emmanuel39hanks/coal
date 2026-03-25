import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser, hasWriteAccess } from '@/lib/privy';
import { createProductSchema, validateBody } from '@/lib/schemas';
import { errors, apiSuccess } from '@/lib/errors';
import { rateLimiters, checkRateLimit } from '@/lib/rate-limit';
import { syncMerchantArtifacts } from '@/lib/0g/merchant';

export async function GET(request: Request) {
    try {
        const user = await getAuthUser(request);
        if (!user) return errors.unauthorized();

        const products = await prisma.product.findMany({
            where: { merchantId: user.id, active: true },
            orderBy: { createdAt: 'desc' },
            include: { _count: { select: { checkoutSessions: true } } }
        });

        return apiSuccess({
            products: products.map(p => ({
                id:          p.id,
                name:        p.name,
                description: p.description,
                price:       p.price.toString(),
                image:       p.image,
                billingType: p.billingType,
                billingInterval: p.billingInterval,
                billingIntervalCount: p.billingIntervalCount,
                sales:       p._count.checkoutSessions,
            }))
        });
    } catch {
        return errors.internal();
    }
}

export async function POST(request: Request) {
    try {
        const user = await getAuthUser(request);
        if (!user) return errors.unauthorized();
        if (!hasWriteAccess(user)) return errors.forbidden();

        const { limited } = await checkRateLimit(rateLimiters.console, user.id);
        if (limited) return errors.rateLimited();

        const body = await request.json().catch(() => ({}));
        const validated = validateBody(createProductSchema, body);
        if (!validated.success) return validated.error;

        const {
            name,
            description,
            price,
            image,
            billingType,
            billingInterval,
            billingIntervalCount,
        } = validated.data;

        const product = await prisma.product.create({
            data: {
                merchantId: user.id,
                name,
                description,
                price,
                image: image || null,
                billingType,
                billingInterval: billingType === 'subscription' ? billingInterval || null : null,
                billingIntervalCount: billingType === 'subscription' ? billingIntervalCount || 1 : 1,
            }
        });

        const merchantSync = await syncMerchantArtifacts(user.id).catch(() => null);

        return apiSuccess({
            ...product,
            zeroG: merchantSync,
        }, 201);
    } catch {
        return errors.internal();
    }
}
