import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser, hasWriteAccess } from '@/lib/privy';
import { updateProductSchema, validateBody } from '@/lib/schemas';
import { errors, apiSuccess } from '@/lib/errors';
import { syncMerchantArtifacts } from '@/lib/0g/merchant';

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getAuthUser(request);
        if (!user) return errors.unauthorized();
        if (!hasWriteAccess(user)) return errors.forbidden();

        const { id } = await params;
        const body = await request.json().catch(() => ({}));
        const validated = validateBody(updateProductSchema, body);
        if (!validated.success) return validated.error;

        const existing = await prisma.product.findUnique({ where: { id } });
        if (!existing || existing.merchantId !== user.id) {
            return errors.notFound('Product');
        }

        const {
            name,
            description,
            price,
            image,
            billingType,
            billingInterval,
            billingIntervalCount,
        } = validated.data;
        const updated = await prisma.product.update({
            where: { id },
            data: {
                ...(name        !== undefined && { name }),
                ...(description !== undefined && { description }),
                ...(price       !== undefined && { price }),
                ...(image       !== undefined && { image: image || null }),
                ...(billingType !== undefined && {
                    billingType,
                    billingInterval: billingType === 'subscription'
                        ? (billingInterval === undefined || billingInterval === '' ? existing.billingInterval : billingInterval)
                        : null,
                    billingIntervalCount: billingType === 'subscription'
                        ? (billingIntervalCount ?? existing.billingIntervalCount)
                        : 1,
                }),
                ...(billingType === undefined && billingInterval !== undefined && {
                    billingInterval: billingInterval === '' ? null : billingInterval,
                }),
                ...(billingType === undefined && billingIntervalCount !== undefined && {
                    billingIntervalCount,
                }),
            }
        });

        const zeroG = await syncMerchantArtifacts(user.id).catch(() => null);

        return apiSuccess({
            ...updated,
            zeroG,
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
        if (!hasWriteAccess(user)) return errors.forbidden();

        const { id } = await params;
        const existing = await prisma.product.findUnique({ where: { id } });
        if (!existing || existing.merchantId !== user.id) {
            return errors.notFound('Product');
        }

        const deleted = await prisma.product.update({ where: { id }, data: { active: false } });
        const zeroG = await syncMerchantArtifacts(user.id).catch(() => null);

        return apiSuccess({
            ...deleted,
            zeroG,
        });
    } catch {
        return errors.internal();
    }
}
