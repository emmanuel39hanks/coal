import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

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
        const existingLink = await prisma.paymentLink.findUnique({
            where: { id }
        });

        if (!existingLink || existingLink.merchantId !== session.user.id) {
            return NextResponse.json({ error: 'Link not found or unauthorized' }, { status: 404 });
        }

        // Soft delete (or hard delete? user asked for delete. Let's do soft delete for safety like products)
        const deletedLink = await prisma.paymentLink.update({
            where: { id },
            data: { active: false }
        });

        return NextResponse.json(deletedLink);

    } catch (error) {
        console.error("Delete Link Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
