import { prisma } from '@/lib/prisma';
import { getAuthUser, hasWriteAccess } from '@/lib/privy';
import { errors, apiSuccess } from '@/lib/errors';
import { rateLimiters, checkRateLimit } from '@/lib/rate-limit';
import { parsePaginationParams, paginatedMeta } from '@/lib/pagination';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getAuthUser(request);
        if (!user) return errors.unauthorized();

        const { limited } = await checkRateLimit(rateLimiters.console, user.id);
        if (limited) return errors.rateLimited();

        const { id } = await params;
        const url = new URL(request.url);
        const pagination = parsePaginationParams(url);

        const paywall = await prisma.paywall.findUnique({ where: { id } });
        if (!paywall || paywall.merchantId !== user.id) {
            return errors.notFound('Paywall');
        }

        const where = { paywallId: id };
        const [accesses, total] = await Promise.all([
            prisma.paywallAccess.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: pagination.skip,
                take: pagination.take,
                select: {
                    id: true,
                    address: true,
                    accessCount: true,
                    expiresAt: true,
                    revokedAt: true,
                    lastAccessAt: true,
                    createdAt: true,
                },
            }),
            prisma.paywallAccess.count({ where }),
        ]);

        return apiSuccess({
            accesses,
            pagination: paginatedMeta(total, pagination),
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
        const body = await request.json().catch(() => ({}));
        const { accessId, reason } = body as { accessId?: string; reason?: string };

        if (!accessId) {
            return errors.validation({ accessId: ['Access ID is required'] });
        }

        const paywall = await prisma.paywall.findUnique({ where: { id } });
        if (!paywall || paywall.merchantId !== user.id) {
            return errors.notFound('Paywall');
        }

        const access = await prisma.paywallAccess.findUnique({
            where: { id: accessId },
        });
        if (!access || access.paywallId !== id) {
            return errors.notFound('Access');
        }

        await prisma.paywallAccess.update({
            where: { id: accessId },
            data: {
                revokedAt: new Date(),
                revokedReason: reason || null,
            },
        });

        return apiSuccess({ success: true });
    } catch {
        return errors.internal();
    }
}
