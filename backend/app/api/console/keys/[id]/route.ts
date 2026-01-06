import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

// DELETE /api/console/keys/[id] - Revoke an API key
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

        // Find the key and verify ownership
        const key = await prisma.apiKey.findFirst({
            where: {
                id,
                merchantId: session.user.id,
                revokedAt: null
            }
        });

        if (!key) {
            return NextResponse.json({ error: 'Key not found' }, { status: 404 });
        }

        // Soft delete by setting revokedAt
        await prisma.apiKey.update({
            where: { id },
            data: { revokedAt: new Date() }
        });

        return NextResponse.json({ success: true, message: 'Key revoked successfully' });

    } catch (error) {
        console.error("Revoke Key Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
