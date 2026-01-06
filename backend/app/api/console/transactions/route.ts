import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

export async function GET(request: Request) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const transactions = await prisma.transaction.findMany({
            where: {
                checkout: { merchantId: session.user.id }
            },
            orderBy: { createdAt: 'desc' },
            take: 50, // Limit for MVP
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
                id: tx.txHash || tx.id, // Use hash if valid, else ID
                type: 'Payment', // Future: Payout
                amount: tx.amount.toString(),
                status: tx.status === 'confirmed' ? 'Confirmed' : 'Failed',
                date: tx.createdAt,
                description: tx.checkout?.product?.name || tx.checkout?.description || "Payment"
            }))
        });

    } catch (error) {
        console.error("Transactions Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
