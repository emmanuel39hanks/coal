import { prisma } from '@/lib/prisma';
import { getAuthUser, hasWriteAccess } from '@/lib/privy';
import { errors, apiSuccess } from '@/lib/errors';
import { rateLimiters, checkRateLimit } from '@/lib/rate-limit';
import { validateRecipients, SplitRecipient } from '@/lib/splits';
import { z } from 'zod';
import { validateBody } from '@/lib/schemas';

const recipientSchema = z.object({
    address: z.string().min(1, 'Address required'),
    percent: z.number().int('Percent must be an integer'),
    label: z.string().max(100).optional(),
});

const updateSplitSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    recipients: z.array(recipientSchema).optional(),
});

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getAuthUser(request);
        if (!user) return errors.unauthorized();
        if (!hasWriteAccess(user)) return errors.forbidden();

        const { limited } = await checkRateLimit(rateLimiters.console, user.id);
        if (limited) return errors.rateLimited();

        const { id } = await params;

        const existing = await prisma.splitConfig.findUnique({ where: { id } });
        if (!existing) return errors.notFound('Split config');
        if (existing.merchantId !== user.id) return errors.forbidden();

        const body = await request.json().catch(() => ({}));
        const validated = validateBody(updateSplitSchema, body);
        if (!validated.success) return validated.error;

        const { name, recipients } = validated.data;

        if (recipients !== undefined) {
            const recipientError = validateRecipients(recipients as SplitRecipient[]);
            if (recipientError) {
                return errors.validation({ recipients: [recipientError] });
            }
        }

        const updated = await prisma.splitConfig.update({
            where: { id },
            data: {
                ...(name !== undefined && { name }),
                ...(recipients !== undefined && { recipients: recipients as object[] }),
            },
        });

        return apiSuccess({
            id:         updated.id,
            name:       updated.name,
            recipients: updated.recipients,
            active:     updated.active,
            createdAt:  updated.createdAt,
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

        const { limited } = await checkRateLimit(rateLimiters.console, user.id);
        if (limited) return errors.rateLimited();

        const { id } = await params;

        const existing = await prisma.splitConfig.findUnique({ where: { id } });
        if (!existing) return errors.notFound('Split config');
        if (existing.merchantId !== user.id) return errors.forbidden();

        await prisma.splitConfig.update({
            where: { id },
            data: { active: false },
        });

        return apiSuccess({ success: true });
    } catch {
        return errors.internal();
    }
}
