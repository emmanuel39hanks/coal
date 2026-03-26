import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { logger } from '@/lib/logger';

// DEV ONLY: seed route is blocked in production
export async function GET(request: Request) {
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Dev only' }, { status: 403 });
    }

    // Require DEV_SEED_SECRET unconditionally — block access if not configured
    const seedSecret = process.env.DEV_SEED_SECRET;
    if (!seedSecret) {
        return NextResponse.json({ error: 'DEV_SEED_SECRET not configured' }, { status: 403 });
    }
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${seedSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // 1. Create Mock User
        const userEmail = "dev@usecoal.xyz";
        let user = await prisma.user.findUnique({ where: { email: userEmail } });

        if (!user) {
            user = await prisma.user.create({
                data: {
                    email: userEmail,
                    name: "Dev Merchant",
                }
            });
        }

        // 2. Create API Key with a random value (never hardcoded)
        const keyRaw = `coal_live_${crypto.randomBytes(24).toString('hex')}`;
        const hashed = crypto.createHash("sha256").update(keyRaw).digest("hex");

        const key = await prisma.apiKey.create({
            data: {
                merchantId: user.id,
                keyPrefix: "coal_live_",
                secretHash: hashed,
                name: "Dev Key"
            }
        });

        return NextResponse.json({
            message: "Seed Successful",
            user: { id: user.id, email: user.email, name: user.name },
            apiKey: keyRaw, // Show the raw key once
        });

    } catch (error) {
        logger.error({ err: error }, 'Seed error');
        return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
}
