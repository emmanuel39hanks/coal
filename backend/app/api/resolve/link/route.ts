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
                    payoutAddress: true
                }
            }
        }
    });

    if (!link || !link.active) {
        return errors.notFound("Link");
    }

    return apiSuccess(link);
}
