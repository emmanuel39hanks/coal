import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const body = await request.json();
        const { name, description, price, image } = body;

        // Verify ownership
        const existingProduct = await prisma.product.findUnique({
            where: { id }
        });

        if (!existingProduct || existingProduct.merchantId !== session.user.id) {
            return NextResponse.json({ error: 'Product not found or unauthorized' }, { status: 404 });
        }

        const updatedProduct = await prisma.product.update({
            where: { id },
            data: {
                name,
                description,
                price: parseFloat(price),
                image
            }
        });

        return NextResponse.json(updatedProduct);

    } catch (error) {
        console.error("Update Product Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;

        // Verify ownership
        const existingProduct = await prisma.product.findUnique({
            where: { id }
        });

        if (!existingProduct || existingProduct.merchantId !== session.user.id) {
            return NextResponse.json({ error: 'Product not found or unauthorized' }, { status: 404 });
        }

        // Soft delete
        const deletedProduct = await prisma.product.update({
            where: { id },
            data: { active: false }
        });

        return NextResponse.json(deletedProduct);

    } catch (error) {
        console.error("Delete Product Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
