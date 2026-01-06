
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug");

    if (!slug) {
        return NextResponse.json({ error: "Slug required" }, { status: 400 });
    }

    const link = await prisma.paymentLink.findUnique({
        where: { slug },
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

    if (!link || !link.active) {
        return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }

    return NextResponse.json(link);
}
