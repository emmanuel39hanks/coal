import { getRecentDAEvents } from '@/lib/0g/da';
import { apiSuccess } from '@/lib/errors';
import { getIP, checkRateLimit, rateLimiters } from '@/lib/rate-limit';

export async function GET(request: Request) {
    const ip = getIP(request);
    const { limited } = await checkRateLimit(rateLimiters.public, ip);
    if (limited) return Response.json({ error: 'Rate limited' }, { status: 429 });

    const events = getRecentDAEvents();
    return apiSuccess({
        events,
        total: events.length,
        daEnabled: process.env.ZERO_G_DA_ENABLED === 'true',
        daEndpoint: process.env.ZERO_G_DA_GRPC_URL || 'localhost:51001',
    });
}
