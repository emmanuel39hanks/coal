import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/privy';
import crypto from 'crypto';
import { createLinkSchema, validateBody } from '@/lib/schemas';
import { errors, apiSuccess } from '@/lib/errors';
import { rateLimiters, checkRateLimit } from '@/lib/rate-limit';
import { toPrismaNullableJson } from '@/lib/prisma-json';

export async function GET(request: Request) {
    try {
        const user = await getAuthUser(request);
        if (!user) return errors.unauthorized();

        const links = await prisma.paymentLink.findMany({
            where: { merchantId: user.id, active: true },
            include: { product: { select: { name: true, price: true, image: true } } },
            orderBy: { createdAt: 'desc' }
        });

        return apiSuccess({
            links: links.map(link => ({
                id:           link.id,
                slug:         link.slug,
                url:          `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/pay/${link.slug}`,
                productName:  link.product?.name || link.title || 'Custom Amount',
                productImage: link.product?.image || null,
                price:        link.product?.price.toString() || 'Flexible',
                payerInfoConfig: link.payerInfoConfig,
                active:       link.active,
                createdAt:    link.createdAt,
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

        const { limited } = await checkRateLimit(rateLimiters.console, user.id);
        if (limited) return errors.rateLimited();

        const body = await request.json().catch(() => ({}));
        const validated = validateBody(createLinkSchema, body);
        if (!validated.success) return validated.error;

        const { productId, slug, title, description, payerInfo } = validated.data;

        let finalSlug = slug;
        if (finalSlug) {
            const existing = await prisma.paymentLink.findUnique({ where: { slug: finalSlug } });
            if (existing) return errors.conflict('SLUG_TAKEN', 'Slug already taken');
        } else {
            let unique = false;
            while (!unique) {
                finalSlug = crypto.randomBytes(8).toString('hex');
                const existing = await prisma.paymentLink.findUnique({ where: { slug: finalSlug } });
                if (!existing) unique = true;
            }
        }

        const link = await prisma.paymentLink.create({
            data: {
                merchantId:  user.id,
                productId:   productId || null,
                slug:        finalSlug!,
                title:       title || null,
                description: description || null,
                payerInfoConfig: toPrismaNullableJson(payerInfo),
            }
        });

        return apiSuccess(link, 201);
    } catch {
        return errors.internal();
    }
}
