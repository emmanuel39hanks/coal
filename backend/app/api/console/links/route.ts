import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import crypto from 'crypto';

export async function GET(request: Request) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const links = await prisma.paymentLink.findMany({
            where: {
                merchantId: session.user.id,
                active: true
            },
            include: {
                product: {
                    select: { name: true, price: true, image: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json({
            links: links.map(link => ({
                id: link.id,
                slug: link.slug,
                url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/pay/${link.slug}`,
                productName: link.product?.name || link.title || 'Custom Amount',
                productImage: link.product?.image || null,
                price: link.product?.price.toString() || 'Flexible',
                active: link.active,
                createdAt: link.createdAt
            }))
        });

    } catch (error) {
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
        const { productId, slug, title, description } = body;

        // Generate slug if not provided
        const finalSlug = slug || crypto.randomBytes(4).toString('hex');

        // Check if slug exists
        const existing = await prisma.paymentLink.findUnique({
            where: { slug: finalSlug }
        });

        if (existing) {
            return NextResponse.json({ error: 'Slug already taken' }, { status: 400 });
        }

        const link = await prisma.paymentLink.create({
            data: {
                merchantId: session.user.id,
                productId: productId || null,
                slug: finalSlug,
                title: title || null,
                description: description || null
            }
        });

        return NextResponse.json(link);

    } catch (error) {
        console.error("Create Link Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
