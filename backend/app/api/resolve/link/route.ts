import { prisma } from "@/lib/prisma";
import { errors, apiSuccess } from "@/lib/errors";
import { getIP, checkRateLimit, rateLimiters } from "@/lib/rate-limit";

export async function GET(request: Request) {
    const ip = getIP(request);
    const { limited } = await checkRateLimit(rateLimiters.public, ip);
    if (limited) return errors.rateLimited();

    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug");

    if (!slug) {
        return errors.validation({ slug: ["Slug required"] });
    }

    const link = await prisma.paymentLink.findUnique({
        where: { slug },
        include: {
            product: true,
            merchant: {
                select: {
                    name: true,
                    image: true,
                    payoutAddress: true,
                }
            }
        }
    });

    if (!link || !link.active) {
        return errors.notFound("Link");
    }

    // Check if link has expired
    if (link.expiresAt && link.expiresAt < new Date()) {
        return errors.gone('This payment link has expired');
    }

    // Check if link has reached max uses
    if (link.maxUses && link.useCount >= link.maxUses) {
        return errors.gone('This payment link has reached its usage limit');
    }

    // Increment view count (fire-and-forget)
    void prisma.paymentLink.update({
        where: { id: link.id },
        data: { viewCount: { increment: 1 } },
    }).catch(() => null);

    return apiSuccess(link);
}
