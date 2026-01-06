
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

    // Extract product info from splits JSON (used as metadata storage)
    const metadata = session.splits as any || {};

    // Build response with product info from either linked product or splits metadata
    const response = {
        id: session.id,
        amount: session.amount.toString(),
        currency: session.currency,
        description: session.description,
        status: session.status,
        redirectUrl: session.redirectUrl,
        merchant: session.merchant,
        // Product info - prefer linked product, fallback to metadata in splits
        product: session.product ? {
            name: session.product.name,
            price: session.product.price.toString(),
            image: session.product.image,
            description: session.product.description,
        } : metadata.productName ? {
            name: metadata.productName,
            price: session.amount.toString(),
            image: metadata.productImage,
            description: metadata.productDescription,
        } : null
    };

    return NextResponse.json(response);
}
