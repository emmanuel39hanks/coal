import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth'; // Better Auth Server
import { headers } from 'next/headers';

export async function GET(request: Request) {
    try {
        // 1. Session Auth
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = session.user.id;

        // 2. Fetch Stats
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
        console.error("Stats Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
