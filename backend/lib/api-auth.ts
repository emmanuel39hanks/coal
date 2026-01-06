import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function validateApiKey(req: Request) {
    const apiKey = req.headers.get("x-api-key");

    if (!apiKey) {
        return null;
    }

    // Hash the incoming key to match DB storage
    const hashed = crypto.createHash("sha256").update(apiKey).digest("hex");

    const keyRecord = await prisma.apiKey.findFirst({
        where: {
            secretHash: hashed,
            revokedAt: null
        },
        include: {
            merchant: true
        }
    });

    if (keyRecord) {
        // Update last used asynchronously
        await prisma.apiKey.update({
            where: { id: keyRecord.id },
            data: { lastUsed: new Date() }
        });
    }

    return keyRecord; // Returns { merchant: User, ... } or null
}
