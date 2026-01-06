
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { linkId, amount } = body;

        if (!linkId) {
            return NextResponse.json({ error: "Link ID required" }, { status: 400 });
        }

        const link = await prisma.paymentLink.findUnique({
            where: { id: linkId },
            include: { product: true }
        });

        if (!link || !link.active) {
            return NextResponse.json({ error: "Link not found or inactive" }, { status: 404 });
        }

        // Determine amount
        let sessionAmount = 0;
        if (link.product) {
            sessionAmount = parseFloat(link.product.price);
        } else {
            if (!amount) {
                return NextResponse.json({ error: "Amount required for flexible link" }, { status: 400 });
            }
            sessionAmount = parseFloat(amount);
        }

        // Create Checkout Session
        const session = await prisma.checkoutSession.create({
            data: {
                merchantId: link.merchantId,
                amount: sessionAmount,
                currency: "MNEE",
                description: link.product ? link.product.name : (link.title || "Payment"),
                status: "pending",
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
            }
        });

        return NextResponse.json({ sessionId: session.id });

    } catch (error) {
        console.error("Create session error:", error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
