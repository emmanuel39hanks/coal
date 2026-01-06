import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const session = await prisma.checkoutSession.findUnique({
            where: { id },
            include: {
                product: {
                    select: {
                        name: true,
                        image: true
                    }
                },
                merchant: {
                    select: {
                        name: true,
                        image: true
                    }
                }
            }
        });

        if (!session) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        // Return public details needed for the Payment Page
        return NextResponse.json({
            id: session.id,
            amount: session.amount.toString(), // Decimal to string
            currency: session.currency,
            description: session.description,
            status: session.status,
            expiresAt: session.expiresAt,
            merchant: {
                name: session.merchant.name,
                image: session.merchant.image
            },
            product: session.product,
            splits: session.splits
        });

    } catch (error) {
        console.error("Get Session Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
