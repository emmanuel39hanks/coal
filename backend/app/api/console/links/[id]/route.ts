import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser, hasWriteAccess } from '@/lib/privy';
import { errors, apiSuccess } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { updateLinkSchema, validateBody } from '@/lib/schemas';
import { toPrismaNullableJson } from '@/lib/prisma-json';

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
        const validated = validateBody(updateLinkSchema, body);
        if (!validated.success) return validated.error;

        const existing = await prisma.paymentLink.findUnique({ where: { id } });
        if (!existing || existing.merchantId !== user.id) {
            return errors.notFound('Link');
        }

        const { slug, title, description, payerInfo, expiresAt, maxUses, redirectUrl, allowQuantity, minQuantity, maxQuantity, active } = validated.data;

        // If changing slug, check it's not taken
        if (slug && slug !== existing.slug) {
            const slugTaken = await prisma.paymentLink.findUnique({ where: { slug } });
            if (slugTaken) return errors.conflict('SLUG_TAKEN', 'Slug already taken');
        }

        const updated = await prisma.paymentLink.update({
            where: { id },
            data: {
                ...(slug          !== undefined && { slug }),
                ...(title         !== undefined && { title: title || null }),
                ...(description   !== undefined && { description: description || null }),
                ...(payerInfo     !== undefined && { payerInfoConfig: toPrismaNullableJson(payerInfo) }),
                ...(expiresAt     !== undefined && { expiresAt: expiresAt ?? null }),
                ...(maxUses       !== undefined && { maxUses: maxUses ?? null }),
                ...(redirectUrl   !== undefined && { redirectUrl: redirectUrl || null }),
                ...(allowQuantity !== undefined && { allowQuantity }),
                ...(minQuantity   !== undefined && { minQuantity }),
                ...(maxQuantity   !== undefined && { maxQuantity }),
                ...(active        !== undefined && { active }),
            },
        });

        return apiSuccess(updated);
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
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (!hasWriteAccess(user)) return errors.forbidden();

        const { id } = await params;

        // Verify ownership
        const existingLink = await prisma.paymentLink.findUnique({
            where: { id }
        });

        if (!existingLink || existingLink.merchantId !== user.id) {
            return NextResponse.json({ error: 'Link not found or unauthorized' }, { status: 404 });
        }

        // Soft delete
        const deletedLink = await prisma.paymentLink.update({
            where: { id },
            data: { active: false }
        });

        return NextResponse.json(deletedLink);

    } catch (error) {
        logger.error({ err: error }, 'Delete link error');
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
