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

        const keys = await prisma.apiKey.findMany({
            where: {
                merchantId: session.user.id,
                revokedAt: null
            },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json({
            keys: keys.map(k => ({
                id: k.id,
                name: k.name,
                prefix: k.keyPrefix,
                lastUsed: k.lastUsed,
                createdAt: k.createdAt
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
        const { name } = body;

        // Generate Key: coal_live_[32_random_bytes_hex]
        const randomBytes = crypto.randomBytes(24).toString('hex');
        const secretKey = `coal_live_${randomBytes}`;

        // Hash for storage
        const hashed = crypto.createHash('sha256').update(secretKey).digest('hex');

        const key = await prisma.apiKey.create({
            data: {
                merchantId: session.user.id,
                name: name || 'Secret Key',
                keyPrefix: 'coal_live_',
                secretHash: hashed
            }
        });

        return NextResponse.json({
            key: {
                id: key.id,
                name: key.name,
                secret: secretKey, // Return ONLY once
                createdAt: key.createdAt
            }
        });

    } catch (error) {
        console.error("Create Key Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
