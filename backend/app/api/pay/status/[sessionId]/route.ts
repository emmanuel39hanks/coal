import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { logger } from '@/lib/logger';
import { getIP, checkRateLimit, rateLimiters } from '@/lib/rate-limit';

const VALID_SESSION_ID = /^[a-z0-9]{20,36}$/;

export async function GET(
    request: Request,
    { params }: { params: Promise<{ sessionId: string }> }
) {
    try {
        const ip = getIP(request);
        const { limited } = await checkRateLimit(rateLimiters.public, ip);
        if (limited) {
            return NextResponse.json({ error: "Too many requests" }, { status: 429 });
        }

        const { sessionId } = await params;

        if (!VALID_SESSION_ID.test(sessionId)) {
            return NextResponse.json({ error: "Session not found" }, { status: 404 });
        }

        const session = await prisma.checkoutSession.findUnique({
            where: { id: sessionId },
            select: {
                status: true,
                txHash: true,
                pendingTxHash: true,
                redirectUrl: true,
                expiresAt: true,
                amount: true,
                currency: true,
            }
        });

        if (!session) {
            return NextResponse.json({ error: "Session not found" }, { status: 404 });
        }

        // Auto-expire if past deadline and still unresolved
        if (
            (session.status === "pending" || session.status === "verifying") &&
            session.expiresAt < new Date()
        ) {
            await prisma.checkoutSession.update({
                where: { id: sessionId },
                data: { status: "expired" }
            });
            return NextResponse.json({ status: "expired" });
        }

        // If still verifying and has a pending tx, trigger verification inline
        if (session.status === 'verifying' && session.pendingTxHash) {
            const cronSecret = process.env.CRON_SECRET;
            if (cronSecret) {
                // Use VERCEL_URL or API_BASE_URL to ensure we hit the backend, not the frontend
                const apiBase = process.env.API_BASE_URL
                    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : new URL(request.url).origin);
                const verifyUrl = `${apiBase}/api/cron/verify-payments`;
                fetch(verifyUrl, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${cronSecret}` },
                }).catch(() => null);
            }
        }

        return NextResponse.json({
            status: session.status,
            txHash: session.txHash ?? session.pendingTxHash ?? null,
            redirectUrl: session.status === "confirmed" ? session.redirectUrl : null,
        });

    } catch (error) {
        logger.error({ err: error }, 'Status check error');
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
