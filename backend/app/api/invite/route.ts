import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { errors, apiSuccess, apiError } from '@/lib/errors';

// Public endpoint — returns invite preview info without exposing sensitive data
export async function GET(request: NextRequest) {
    try {
        const token = request.nextUrl.searchParams.get('token');
        if (!token) return errors.validation({ token: ['Token is required'] });

        const invites = await prisma.verification.findMany({
            where: {
                identifier: { startsWith: 'team_invite:' },
                expiresAt: { gt: new Date() },
            },
        });

        const invite = invites.find(i => {
            try {
                return JSON.parse(i.value).token === token;
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
