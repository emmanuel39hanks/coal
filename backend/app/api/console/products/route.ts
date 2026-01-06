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

        const products = await prisma.product.findMany({
            where: {
                merchantId: session.user.id,
                active: true
            },
            orderBy: { createdAt: 'desc' },
            include: {
                _count: {
                    select: { checkoutSessions: true }
                }
            }
        });

        return NextResponse.json({
            products: products.map(p => ({
                id: p.id,
                name: p.name,
                description: p.description,
                price: p.price.toString(),
                image: p.image,
                sales: p._count.checkoutSessions
            }))
        });

    } catch (error) {
        console.error("Get Products Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { name, description, price, image } = body;

        if (!name || !price) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const product = await prisma.product.create({
            data: {
                merchantId: session.user.id,
                name,
                description,
                price: parseFloat(price),
                image
            }
        });

        return NextResponse.json(product);

    } catch (error) {
        console.error("Create Product Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
