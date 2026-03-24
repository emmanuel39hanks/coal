import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/privy';
import { logger } from '@/lib/logger';

export async function GET(request: Request) {
    try {
        const user = await getAuthUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = user.id;

        // Total Volume (Sum of confirmed transactions)
        const totalVolume = await prisma.transaction.aggregate({
            where: {
                checkout: { merchantId: userId },
                status: 'confirmed'
            },
            _sum: { amount: true }
        });

        // Total Transactions
        const totalTx = await prisma.transaction.count({
            where: {
                checkout: { merchantId: userId },
                status: 'confirmed'
            }
        });

        // Active Products
        const activeItems = await prisma.product.count({
            where: {
                merchantId: userId,
                active: true
            }
        });

        // Recent 5 Transactions
        const recentTx = await prisma.transaction.findMany({
            where: { checkout: { merchantId: userId } },
            take: 5,
            orderBy: { createdAt: 'desc' },
            include: { checkout: { select: { product: { select: { name: true } } } } }
        });

        return NextResponse.json({
            revenue: totalVolume._sum.amount?.toString() || "0",
            totalTransactions: totalTx,
            activeItems: activeItems,
            recentActivity: recentTx.map(tx => ({
                id: tx.id,
                amount: tx.amount.toString(),
                status: tx.status,
                date: tx.createdAt,
                product: tx.checkout?.product?.name || "Payment Link"
            }))
        });

    } catch (error) {
        logger.error({ err: error }, 'Stats error');
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
