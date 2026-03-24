import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/privy';
import { logger } from '@/lib/logger';

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getAuthUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;

        // Verify ownership
        const existingLink = await prisma.paymentLink.findUnique({
            where: { id }
        });

        if (!existingLink || existingLink.merchantId !== user.id) {
            return NextResponse.json({ error: 'Link not found or unauthorized' }, { status: 404 });
        }

        // Soft delete
        const deletedLink = await prisma.paymentLink.update({
            where: { id },
            data: { active: false }
        });

        return NextResponse.json(deletedLink);

    } catch (error) {
        logger.error({ err: error }, 'Delete link error');
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
