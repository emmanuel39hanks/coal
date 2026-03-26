import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { errors, apiSuccess, apiError } from '@/lib/errors';
import { getIP, checkRateLimit, rateLimiters } from '@/lib/rate-limit';

// Public endpoint — returns invite preview info without exposing sensitive data
export async function GET(request: NextRequest) {
    try {
        const ip = getIP(request);
        const { limited } = await checkRateLimit(rateLimiters.public, ip);
        if (limited) return errors.rateLimited();

        const token = request.nextUrl.searchParams.get('token');
        if (!token || token.length < 16) return errors.validation({ token: ['Token is required'] });

        const invites = await prisma.verification.findMany({
            where: {
                identifier: { startsWith: 'team_invite:' },
                expiresAt: { gt: new Date() },
            },
            take: 500,
        });

        const invite = invites.find(i => {
            try {
                const val = JSON.parse(i.value);
                const expected = Buffer.from(val.token ?? '');
                const actual = Buffer.from(token);
                return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
            } catch {
                return false;
            }
        });

        if (!invite) {
            return apiError('NOT_FOUND', 'This invite has expired or already been used', 404);
        }

        const { merchantName, role } = JSON.parse(invite.value);
        const expiresAt = invite.expiresAt;

        return apiSuccess({ merchantName, role, expiresAt });
    } catch {
        return errors.internal();
    }
}
