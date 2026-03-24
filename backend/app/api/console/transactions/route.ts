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

        const transactions = await prisma.transaction.findMany({
            where: {
                checkout: { merchantId: user.id }
            },
            orderBy: { createdAt: 'desc' },
            take: 50,
            include: {
                checkout: {
                    select: {
                        description: true,
                        product: { select: { name: true } }
                    }
                }
            }
        });

        return NextResponse.json({
            transactions: transactions.map(tx => ({
                id: tx.id,
                txHash: tx.txHash,
                type: 'Payment',
                amount: tx.amount.toString(),
                currency: tx.token,
                status: tx.status === 'confirmed' ? 'Confirmed' : 'Failed',
                date: tx.createdAt,
                description: tx.checkout?.product?.name || tx.checkout?.description || "Payment"
            }))
        });

    } catch (error) {
        logger.error({ err: error }, 'Transactions error');
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
