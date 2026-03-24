
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
        return NextResponse.json({ error: "ID required" }, { status: 400 });
    }

    const session = await prisma.checkoutSession.findUnique({
        where: { id },
        include: {
            product: true,
            merchant: {
                select: {
                    name: true,
                    image: true,
                    payoutAddress: true
                }
            }
        }
    });

    if (!session) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Reject expired sessions — mark DB and return 410
    if (session.status === "expired" || (session.expiresAt < new Date() && session.status !== "confirmed")) {
        if (session.status !== "expired") {
            await prisma.checkoutSession.update({ where: { id }, data: { status: "expired" } });
        }
        return NextResponse.json({ error: "Session expired", status: "expired" }, { status: 410 });
    }

    // Extract product info — prefer metadata, fall back to splits for older sessions
    const metadata = (session.metadata as any) || (session.splits as any) || {};

    // Build response with product info from either linked product or splits metadata
    const response = {
        id: session.id,
        amount: session.amount.toString(),
        currency: session.currency,
        description: session.description,
        status: session.status,
        billingReason: session.billingReason,
        customerEmail: session.customerEmail,
        customerAddress: session.customerAddress,
        payerInfoConfig: session.payerInfoConfig || (metadata.payerInfoConfig ?? null),
        payerInfo: session.payerInfo || (metadata.payerInfoValues ?? null),
        redirectUrl: session.redirectUrl,
        merchant: session.merchant,
        // Product info - prefer linked product, fallback to metadata in splits
        product: session.product ? {
            name: session.product.name,
            price: session.product.price.toString(),
            image: session.product.image,
            description: session.product.description,
            billingType: session.product.billingType,
            billingInterval: session.product.billingInterval,
            billingIntervalCount: session.product.billingIntervalCount,
        } : metadata.productName ? {
            name: metadata.productName,
            price: session.amount.toString(),
            image: metadata.productImage,
            description: metadata.productDescription,
            billingType: typeof metadata.billingType === 'string' ? metadata.billingType : 'one_time',
            billingInterval: typeof metadata.billingInterval === 'string' ? metadata.billingInterval : null,
            billingIntervalCount: typeof metadata.billingIntervalCount === 'number' ? metadata.billingIntervalCount : 1,
        } : null
    };

    return NextResponse.json(response);
}
