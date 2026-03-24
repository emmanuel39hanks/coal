import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { logger } from '@/lib/logger';

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ sessionId: string }> }
) {
    try {
        const { sessionId } = await params;

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
