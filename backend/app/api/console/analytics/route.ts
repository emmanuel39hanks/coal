import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/privy';
import { errors } from '@/lib/errors';
import { rateLimiters, checkRateLimit, getIP } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

type Period = 'today' | '7d' | '30d' | '90d' | '1y' | 'all';
type GroupBy = 'day' | 'week' | 'month';

function getPeriodDays(period: Period): number {
    switch (period) {
        case 'today': return 1;
        case '7d': return 7;
        case '30d': return 30;
        case '90d': return 90;
        case '1y': return 365;
        case 'all': return 0; // special case
        default: return 30;
    }
}

function formatDate(date: Date): string {
    return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

function groupDateKey(date: Date, groupBy: GroupBy): string {
    if (groupBy === 'day') return formatDate(date);
    if (groupBy === 'week') {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        d.setDate(diff);
        return formatDate(d);
    }
    // month
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

function percentChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 1000) / 10;
}

export async function GET(request: Request) {
    // Rate limit
    const ip = getIP(request);
    const { limited, headers: rlHeaders } = await checkRateLimit(rateLimiters.console, `console:analytics:${ip}`);
    if (limited) {
        return NextResponse.json(
            { error: { code: 'RATE_LIMITED', message: 'Too many requests.' } },
            { status: 429, headers: rlHeaders }
        );
    }

    const user = await getAuthUser(request);
    if (!user) return errors.unauthorized();

    const url = new URL(request.url);
    const periodParam = (url.searchParams.get('period') ?? '30d') as Period;
    const groupByParam = (url.searchParams.get('groupBy') ?? 'day') as GroupBy;

    const validPeriods: Period[] = ['today', '7d', '30d', '90d', '1y', 'all'];
    const validGroupBys: GroupBy[] = ['day', 'week', 'month'];
    const period: Period = validPeriods.includes(periodParam) ? periodParam : '30d';
    const groupBy: GroupBy = validGroupBys.includes(groupByParam) ? groupByParam : 'day';

    const days = getPeriodDays(period);
    const now = new Date();

    let currentStart: Date;
    if (period === 'today') {
        currentStart = new Date(now);
        currentStart.setHours(0, 0, 0, 0);
    } else if (period === 'all') {
        // Use epoch as start — no lower bound
        currentStart = new Date(0);
    } else {
        currentStart = new Date(now);
        currentStart.setDate(currentStart.getDate() - days);
        currentStart.setHours(0, 0, 0, 0);
    }

    const previousStart = new Date(currentStart);
    if (period !== 'all') {
        previousStart.setDate(previousStart.getDate() - (period === 'today' ? 1 : days));
    }

    try {
        // Build date filter for current period
        const currentDateFilter =
            period === 'all'
                ? {}
                : { createdAt: { gte: currentStart, lt: now } };

        // Query confirmed transactions for current period
        const currentTxs = await prisma.transaction.findMany({
            where: {
                checkout: { merchantId: user.id },
                status: 'confirmed',
                ...currentDateFilter,
            },
            select: {
                amount: true,
                createdAt: true,
                checkout: {
                    select: {
                        product: { select: { name: true } },
                    },
                },
            },
            orderBy: { createdAt: 'asc' },
        });

        // Query total checkout sessions created in current period (for conversion rate)
        const totalSessionsCreated = await prisma.checkoutSession.count({
            where: {
                merchantId: user.id,
                ...(period === 'all' ? {} : { createdAt: { gte: currentStart, lt: now } }),
            },
        });

        // Query confirmed transactions for previous period (skip for 'all')
        const previousTxs =
            period === 'all'
                ? []
                : await prisma.transaction.findMany({
                      where: {
                          checkout: { merchantId: user.id },
                          status: 'confirmed',
                          createdAt: { gte: previousStart, lt: currentStart },
                      },
                      select: { amount: true },
                  });

        // Current period aggregates
        const currentRevenue = currentTxs.reduce((sum, tx) => sum + parseFloat(tx.amount.toString()), 0);
        const currentCount = currentTxs.length;
        const currentAov = currentCount > 0 ? currentRevenue / currentCount : 0;
        const conversionRate =
            totalSessionsCreated > 0
                ? Math.round((currentCount / totalSessionsCreated) * 1000) / 1000
                : 0;

        // Previous period aggregates
        const prevRevenue = previousTxs.reduce((sum, tx) => sum + parseFloat(tx.amount.toString()), 0);
        const prevCount = previousTxs.length;
        const prevAov = prevCount > 0 ? prevRevenue / prevCount : 0;

        // Build chart data — group by day/week/month, fill gaps
        const grouped = new Map<string, { revenue: number; count: number }>();
        for (const tx of currentTxs) {
            const key = groupDateKey(tx.createdAt, groupBy);
            const existing = grouped.get(key) ?? { revenue: 0, count: 0 };
            existing.revenue += parseFloat(tx.amount.toString());
            existing.count += 1;
            grouped.set(key, existing);
        }

        // Generate all date keys in range
        const chart: { date: string; revenue: string; count: number }[] = [];
        // For 'all', derive chart days from actual transaction range or use grouped keys directly
        const chartDays =
            period === 'all'
                ? 0 // handled separately below
                : period === 'today'
                ? 1
                : days;

        if (period === 'all') {
            // Emit only the grouped keys that have data, sorted
            const sortedKeys = Array.from(grouped.keys()).sort();
            for (const key of sortedKeys) {
                const entry = grouped.get(key)!;
                chart.push({ date: key, revenue: entry.revenue.toFixed(2), count: entry.count });
            }
        } else if (groupBy === 'day') {
            for (let i = 0; i < chartDays; i++) {
                const d = addDays(currentStart, i);
                const key = formatDate(d);
                const entry = grouped.get(key) ?? { revenue: 0, count: 0 };
                chart.push({ date: key, revenue: entry.revenue.toFixed(2), count: entry.count });
            }
        } else if (groupBy === 'week') {
            const seen = new Set<string>();
            for (let i = 0; i < chartDays; i++) {
                const d = addDays(currentStart, i);
                const key = groupDateKey(d, 'week');
                if (!seen.has(key)) {
                    seen.add(key);
                    const entry = grouped.get(key) ?? { revenue: 0, count: 0 };
                    chart.push({ date: key, revenue: entry.revenue.toFixed(2), count: entry.count });
                }
            }
        } else {
            // month
            const seen = new Set<string>();
            for (let i = 0; i < chartDays; i++) {
                const d = addDays(currentStart, i);
                const key = groupDateKey(d, 'month');
                if (!seen.has(key)) {
                    seen.add(key);
                    const entry = grouped.get(key) ?? { revenue: 0, count: 0 };
                    chart.push({ date: key, revenue: entry.revenue.toFixed(2), count: entry.count });
                }
            }
        }

        // Top products
        const productMap = new Map<string, { revenue: number; count: number }>();
        for (const tx of currentTxs) {
            const name = tx.checkout?.product?.name ?? 'Payment Link';
            const existing = productMap.get(name) ?? { revenue: 0, count: 0 };
            existing.revenue += parseFloat(tx.amount.toString());
            existing.count += 1;
            productMap.set(name, existing);
        }
        const topProducts = Array.from(productMap.entries())
            .sort((a, b) => b[1].revenue - a[1].revenue)
            .slice(0, 5)
            .map(([name, data]) => ({
                name,
                revenue: data.revenue.toFixed(2),
                count: data.count,
            }));

        return NextResponse.json({
            revenue: {
                total: currentRevenue.toFixed(2),
                change: percentChange(currentRevenue, prevRevenue),
            },
            transactions: {
                total: currentCount,
                change: percentChange(currentCount, prevCount),
            },
            avgOrderValue: {
                total: currentAov.toFixed(2),
                change: percentChange(currentAov, prevAov),
            },
            conversionRate,
            chart,
            topProducts,
        });
    } catch (error) {
        logger.error({ err: error }, 'Analytics error');
        return errors.internal();
    }
}
