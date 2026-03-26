import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/privy';
import { errors, apiSuccess } from '@/lib/errors';
import { rateLimiters, checkRateLimit } from '@/lib/rate-limit';

const PERIOD_MAP: Record<string, number> = {
    '7d': 7,
    '30d': 30,
    '90d': 90,
};

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

        const paywall = await prisma.paywall.findUnique({ where: { id } });
        if (!paywall || paywall.merchantId !== user.id) {
            return errors.notFound('Paywall');
        }

        const url = new URL(request.url);
        const period = url.searchParams.get('period') ?? '30d';
        const days = PERIOD_MAP[period] ?? 30;
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const accesses = await prisma.paywallAccess.findMany({
            where: { paywallId: id, createdAt: { gte: since } },
            select: { createdAt: true, address: true },
        });

        // Group by date
        const dailyMap = new Map<string, number>();
        const uniqueAddresses = new Set<string>();

        for (const a of accesses) {
            const dateKey = a.createdAt.toISOString().slice(0, 10);
            dailyMap.set(dateKey, (dailyMap.get(dateKey) ?? 0) + 1);
            uniqueAddresses.add(a.address);
        }

        const daily = Array.from(dailyMap.entries())
            .map(([date, count]) => ({ date, accesses: count }))
            .sort((a, b) => a.date.localeCompare(b.date));

        return apiSuccess({
            daily,
            total: {
                accesses: accesses.length,
                uniqueAddresses: uniqueAddresses.size,
            },
        });
    } catch {
        return errors.internal();
    }
}
