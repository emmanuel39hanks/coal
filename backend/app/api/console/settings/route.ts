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

        // Return user settings
        // Since session might be stale, fetch fresh user
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
                name: true,
                email: true,
                payoutAddress: true
            }
        });

        return NextResponse.json(user);

    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { payoutAddress, name } = body;

        // Basic validation for EVM address
        if (payoutAddress && !/^0x[a-fA-F0-9]{40}$/.test(payoutAddress)) {
            return NextResponse.json({ error: 'Invalid EVM Address' }, { status: 400 });
        }

        const updated = await prisma.user.update({
            where: { id: session.user.id },
            data: {
                name: name || undefined,
                payoutAddress: payoutAddress || undefined
            }
        });

        return NextResponse.json(updated);

    } catch (error) {
        console.error("Update Settings Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
