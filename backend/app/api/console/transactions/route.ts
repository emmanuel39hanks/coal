import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/privy';
import { errors, apiSuccess } from '@/lib/errors';
import { parsePaginationParams, paginatedMeta } from '@/lib/pagination';

export async function GET(request: Request) {
    try {
        const user = await getAuthUser(request);
        if (!user) return errors.unauthorized();

        const url = new URL(request.url);
        const pagination = parsePaginationParams(url);
        const where = { checkout: { merchantId: user.id } };

        const [transactions, total] = await Promise.all([
            prisma.transaction.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: pagination.skip,
                take: pagination.take,
                include: {
                    checkout: {
                        select: {
                            description: true,
                            product: { select: { name: true } }
                        }
                    }
                }
            }),
            prisma.transaction.count({ where }),
        ]);

        return apiSuccess({
            transactions: transactions.map(tx => ({
                id: tx.id,
                txHash: tx.txHash,
                type: 'Payment',
                amount: tx.amount.toString(),
                currency: tx.token,
                status: tx.status === 'confirmed' ? 'Confirmed' : 'Failed',
                date: tx.createdAt,
                description: tx.checkout?.product?.name || tx.checkout?.description || "Payment"
            })),
            pagination: paginatedMeta(total, pagination),
        });
    } catch {
        return errors.internal();
    }
}
