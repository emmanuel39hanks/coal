import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getIP, checkRateLimit, rateLimiters } from '@/lib/rate-limit';
import { getChainByKey, resolveChainKey } from '@/lib/chains';
import { EXPLORER_URL } from '@/lib/chain';

const VALID_ADDRESS = /^0x[a-fA-F0-9]{40}$/;

export async function GET(request: Request) {
    const ip = getIP(request);
    const { limited } = await checkRateLimit(rateLimiters.public, ip);
    if (limited) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address')?.toLowerCase();

    if (!address || !VALID_ADDRESS.test(address)) {
        return NextResponse.json({ error: 'Valid address required' }, { status: 400 });
    }

    const sessions = await prisma.checkoutSession.findMany({
        where: { customerAddress: address, status: 'confirmed' },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
            id: true,
            amount: true,
            currency: true,
            txHash: true,
            settlementChain: true,
            createdAt: true,
            product: {
                select: { name: true, image: true, description: true },
            },
        },
    });

    const orders = sessions.map(s => {
        const chainKey = resolveChainKey(s.settlementChain);
        const explorerBase = chainKey === 'base' ? EXPLORER_URL : getChainByKey(chainKey).explorerUrl;
        return {
            id: s.id,
            amount: s.amount.toString(),
            currency: s.currency,
            txHash: s.txHash,
            explorerUrl: s.txHash ? `${explorerBase}/tx/${s.txHash}` : null,
            chain: s.settlementChain,
            createdAt: s.createdAt.toISOString(),
            product: s.product
                ? { name: s.product.name, image: s.product.image, description: s.product.description }
                : null,
        };
    });

    return NextResponse.json({ orders });
}
