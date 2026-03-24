import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/privy';
import { errors, apiSuccess } from '@/lib/errors';
import { rateLimiters, checkRateLimit } from '@/lib/rate-limit';
import { validateBody, amountField } from '@/lib/schemas';
import { publishPaywallManifest } from '@/lib/0g/paywalls';
import { syncMerchantArtifacts } from '@/lib/0g/merchant';

const createPaywallSchema = z.object({
    name: z.string().min(1, 'Name required').max(200),
    price: amountField,
    currency: z.string().default('USDC'),
    description: z.string().max(2000).optional(),
    contentType: z.string().default('api'),
    contentData: z.record(z.string(), z.unknown()).optional(),
    contentUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
    pricingModel: z.string().default('one_time'),
});

export async function GET(request: Request) {
    try {
        const user = await getAuthUser(request);
        if (!user) return errors.unauthorized();

        const { limited } = await checkRateLimit(rateLimiters.console, user.id);
        if (limited) return errors.rateLimited();

        const paywalls = await prisma.paywall.findMany({
            where: { merchantId: user.id, active: true },
            orderBy: { createdAt: 'desc' },
            include: { _count: { select: { accesses: true } } },
        });

        return apiSuccess({
            paywalls: paywalls.map(p => ({
                id:           p.id,
                name:         p.name,
                description:  p.description,
                price:        p.price.toString(),
                currency:     p.currency,
                contentType:  p.contentType,
                pricingModel: p.pricingModel,
                active:       p.active,
                createdAt:    p.createdAt,
                _count:       { accesses: p._count.accesses },
            })),
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
        const validated = validateBody(createPaywallSchema, body);
        if (!validated.success) return validated.error;

        const { name, price, currency, description, contentType, contentData, contentUrl, pricingModel } = validated.data;

        const paywall = await prisma.paywall.create({
            data: {
                merchantId:   user.id,
                name,
                price,
                currency,
                description:  description ?? null,
                contentType,
                contentData:  contentData !== undefined ? (contentData as Prisma.InputJsonValue) : Prisma.JsonNull,
                contentUrl:   contentUrl || null,
                pricingModel,
            },
        });

        const [manifestResult, merchantSync] = await Promise.allSettled([
            publishPaywallManifest(paywall.id),
            syncMerchantArtifacts(user.id),
        ]);

        return apiSuccess({
            ...paywall,
            zeroG: {
                manifest: manifestResult.status === 'fulfilled' ? manifestResult.value : null,
                merchantSync: merchantSync.status === 'fulfilled' ? merchantSync.value : null,
            },
        }, 201);
    } catch {
        return errors.internal();
    }
}
