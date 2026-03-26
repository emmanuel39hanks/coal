import { prisma } from '@/lib/prisma';
import { getAuthUser, hasWriteAccess } from '@/lib/privy';
import { errors, apiSuccess } from '@/lib/errors';
import { rateLimiters, checkRateLimit } from '@/lib/rate-limit';
import { validateRecipients, SplitRecipient } from '@/lib/splits';
import { z } from 'zod';
import { validateBody } from '@/lib/schemas';
import { parsePaginationParams, paginatedMeta } from '@/lib/pagination';

const recipientSchema = z.object({
    address: z.string().min(1, 'Address required'),
    percent: z.number().int('Percent must be an integer'),
    label: z.string().max(100).optional(),
});

const createSplitSchema = z.object({
    name: z.string().min(1, 'Name required').max(200),
    recipients: z.array(recipientSchema).min(1, 'Recipients required'),
});

export async function GET(request: Request) {
    try {
        const user = await getAuthUser(request);
        if (!user) return errors.unauthorized();

        const url = new URL(request.url);
        const pagination = parsePaginationParams(url);
        const where = { merchantId: user.id, active: true };

        const [splits, total] = await Promise.all([
            prisma.splitConfig.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: pagination.skip,
                take: pagination.take,
            }),
            prisma.splitConfig.count({ where }),
        ]);

        return apiSuccess({
            splits: splits.map(s => ({
                id:         s.id,
                name:       s.name,
                recipients: s.recipients,
                active:     s.active,
                createdAt:  s.createdAt,
            })),
            pagination: paginatedMeta(total, pagination),
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
        const validated = validateBody(createSplitSchema, body);
        if (!validated.success) return validated.error;

        const { name, recipients } = validated.data;

        const recipientError = validateRecipients(recipients as SplitRecipient[]);
        if (recipientError) {
            return errors.validation({ recipients: [recipientError] });
        }

        const split = await prisma.splitConfig.create({
            data: {
                merchantId: user.id,
                name,
                recipients: recipients as object[],
            },
        });

        return apiSuccess({
            id:         split.id,
            name:       split.name,
            recipients: split.recipients,
            active:     split.active,
            createdAt:  split.createdAt,
        }, 201);
    } catch {
        return errors.internal();
    }
}
