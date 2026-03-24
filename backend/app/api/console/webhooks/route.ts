import { getAuthUser } from '@/lib/privy';
import { prisma } from '@/lib/prisma';
import { errors, apiSuccess } from '@/lib/errors';

export async function GET(request: Request) {
    try {
        const user = await getAuthUser(request);
        if (!user) return errors.unauthorized();

        const events = await prisma.webhookEvent.findMany({
            where: { merchantId: user.id },
            orderBy: { createdAt: 'desc' },
            take: 50,
            select: {
                id: true,
                eventType: true,
                url: true,
                status: true,
                attempts: true,
                maxAttempts: true,
                lastAttemptAt: true,
                nextRetryAt: true,
                responseStatus: true,
                errorMessage: true,
                createdAt: true,
                deliveredAt: true,
            }
        });

        return apiSuccess({ events });
    } catch {
        return errors.internal();
    }
}
