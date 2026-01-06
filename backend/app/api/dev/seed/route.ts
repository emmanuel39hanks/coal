import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

// DEV ONLY: Do not deploy to prod without auth protection
export async function GET(request: Request) {
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Dev only' }, { status: 403 });
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

        // 2. Create API Key
        const keyRaw = "coal_live_dev123456";
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
            user: user,
            apiKey: keyRaw, // Show the raw key once
        });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
