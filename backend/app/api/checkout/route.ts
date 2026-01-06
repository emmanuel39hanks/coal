import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateApiKey } from '@/lib/api-auth';

export async function POST(request: Request) {
    try {
        // 1. Auth
        const auth = await validateApiKey(request);
        if (!auth) {
            return NextResponse.json({ error: 'Unauthorized: Invalid API Key' }, { status: 401 });
        }

        // 2. Validate Body
        const body = await request.json();
        const { amount, description, splits, redirectUrl, productId } = body;

        if (!amount || isNaN(parseFloat(amount))) {
            return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
        }

        // 3. Create Session
        const session = await prisma.checkoutSession.create({
            data: {
                merchantId: auth.merchantId,
                amount: parseFloat(amount),
                description: description || "Coal Checkout",
                currency: "MNEE",
                splits: splits ? splits : undefined, // JSON
                status: 'pending',
                redirectUrl: redirectUrl,
                productId: productId,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
            }
        });

        // 4. Return URL
        // In prod, usecoal.xyz/pay/[id]
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const checkoutUrl = `${baseUrl}/pay/${session.id}`;

        return NextResponse.json({
            id: session.id,
            url: checkoutUrl,
            status: session.status,
            expiresAt: session.expiresAt
        });

    } catch (error) {
        console.error("Checkout Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
