import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/privy';
import { errors, apiSuccess } from '@/lib/errors';
import { rateLimiters, checkRateLimit } from '@/lib/rate-limit';
import { validateBody, amountField } from '@/lib/schemas';
import { publishPaywallManifest } from '@/lib/0g/paywalls';
import { syncMerchantArtifacts } from '@/lib/0g/merchant';

const updatePaywallSchema = z.object({
    name:         z.string().min(1).max(200).optional(),
    description:  z.string().max(2000).optional(),
    price:        amountField.optional(),
    contentData:  z.record(z.string(), z.unknown()).optional(),
    contentUrl:   z.string().url('Must be a valid URL').optional().or(z.literal('')),
    active:       z.boolean().optional(),
    pricingModel: z.string().optional(),
});

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getAuthUser(request);
        if (!user) return errors.unauthorized();

        const { limited } = await checkRateLimit(rateLimiters.console, user.id);
        if (limited) return errors.rateLimited();

        const { id } = await params;
        const body = await request.json().catch(() => ({}));
        const validated = validateBody(updatePaywallSchema, body);
        if (!validated.success) return validated.error;

        const existing = await prisma.paywall.findUnique({ where: { id } });
        if (!existing || existing.merchantId !== user.id) {
            return errors.notFound('Paywall');
        }

        const { name, description, price, contentData, contentUrl, active, pricingModel } = validated.data;

        const updated = await prisma.paywall.update({
            where: { id },
            data: {
                ...(name         !== undefined && { name }),
                ...(description  !== undefined && { description }),
                ...(price        !== undefined && { price }),
                ...(contentData  !== undefined && { contentData: contentData as Prisma.InputJsonValue }),
                ...(contentUrl   !== undefined && { contentUrl: contentUrl || null }),
                ...(active       !== undefined && { active }),
                ...(pricingModel !== undefined && { pricingModel }),
            },
        });

        const [manifestResult, merchantSync] = await Promise.allSettled([
            publishPaywallManifest(id),
            syncMerchantArtifacts(user.id),
        ]);

        return apiSuccess({
            ...updated,
            zeroG: {
                manifest: manifestResult.status === 'fulfilled' ? manifestResult.value : null,
                merchantSync: merchantSync.status === 'fulfilled' ? merchantSync.value : null,
            },
        });
    } catch {
        return errors.internal();
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getAuthUser(request);
        if (!user) return errors.unauthorized();

        const { limited } = await checkRateLimit(rateLimiters.console, user.id);
        if (limited) return errors.rateLimited();

        const { id } = await params;

        const existing = await prisma.paywall.findUnique({ where: { id } });
        if (!existing || existing.merchantId !== user.id) {
            return errors.notFound('Paywall');
        }

        await prisma.paywall.update({ where: { id }, data: { active: false } });
        const [manifestResult, merchantSync] = await Promise.allSettled([
            publishPaywallManifest(id),
            syncMerchantArtifacts(user.id),
        ]);

        return apiSuccess({
            success: true,
            zeroG: {
                manifest: manifestResult.status === 'fulfilled' ? manifestResult.value : null,
                merchantSync: merchantSync.status === 'fulfilled' ? merchantSync.value : null,
            },
        });
    } catch {
        return errors.internal();
    }
}
