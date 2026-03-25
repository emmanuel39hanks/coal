import { prisma } from '@/lib/prisma';
import { errors, apiSuccess } from '@/lib/errors';
import { getIP, checkRateLimit, rateLimiters } from '@/lib/rate-limit';

export async function GET(request: Request) {
    try {
        const ip = getIP(request);
        const { limited } = await checkRateLimit(rateLimiters.public, ip);
        if (limited) return errors.rateLimited();

        const { searchParams } = new URL(request.url);
        const address = searchParams.get('address')?.toLowerCase();

        if (!address || !/^0x[a-f0-9]{40}$/.test(address)) {
            return errors.validation({ address: ['Valid EVM address required'] });
        }

        const record = await prisma.nonce.upsert({
            where:  { address },
            create: { address, nonce: 0 },
            update: {},
        });

        return apiSuccess({ address, nonce: record.nonce });
    } catch {
        return errors.internal();
    }
}
