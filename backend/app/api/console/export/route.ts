import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/privy';
import { errors } from '@/lib/errors';
import { rateLimiters, checkRateLimit, getIP } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

export async function GET(request: Request) {
    // Rate limit
    const ip = getIP(request);
    const { limited, headers: rlHeaders } = await checkRateLimit(rateLimiters.console, `console:export:${ip}`);
    if (limited) {
        return NextResponse.json(
            { error: { code: 'RATE_LIMITED', message: 'Too many requests.' } },
            { status: 429, headers: rlHeaders }
        );
    }

    const user = await getAuthUser(request);
    if (!user) return errors.unauthorized();

    const url = new URL(request.url);
    const fromParam = url.searchParams.get('from');
    const toParam = url.searchParams.get('to');

    const fromDate = fromParam ? new Date(fromParam) : undefined;
    const toDate = toParam ? new Date(toParam) : undefined;

    // Validate dates if provided
    if (fromDate && isNaN(fromDate.getTime())) {
        return errors.validation({ from: 'Invalid date format' });
    }
    if (toDate && isNaN(toDate.getTime())) {
        return errors.validation({ to: 'Invalid date format' });
    }

    try {
        const transactions = await prisma.transaction.findMany({
            where: {
                checkout: { merchantId: user.id },
                ...(fromDate || toDate
                    ? {
                          createdAt: {
                              ...(fromDate ? { gte: fromDate } : {}),
                              ...(toDate ? { lte: toDate } : {}),
                          },
                      }
                    : {}),
            },
            select: {
                txHash: true,
                amount: true,
                token: true,
                status: true,
                from: true,
                createdAt: true,
                checkout: {
                    select: {
                        product: { select: { name: true } },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        // Build CSV
        const headers = ['Date', 'TxHash', 'Amount', 'Currency', 'Status', 'Product', 'From'];
        const rows = transactions.map((tx) => {
            const date = tx.createdAt.toISOString();
            const txHash = tx.txHash;
            const amount = tx.amount.toString();
            const currency = tx.token;
            const status = tx.status;
            const product = tx.checkout?.product?.name ?? 'Payment Link';
            const from = tx.from;
            // Escape fields that may contain commas or quotes
            const escape = (val: string) =>
                val.includes(',') || val.includes('"') || val.includes('\n')
                    ? `"${val.replace(/"/g, '""')}"`
                    : val;
            return [date, txHash, amount, currency, status, escape(product), from].join(',');
        });

        const csv = [headers.join(','), ...rows].join('\n');
        const today = new Date().toISOString().slice(0, 10);
        const filename = `coal-transactions-${today}.csv`;

        return new NextResponse(csv, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Cache-Control': 'no-store',
            },
        });
    } catch (error) {
        logger.error({ err: error }, 'Export error');
        return errors.internal();
    }
}
