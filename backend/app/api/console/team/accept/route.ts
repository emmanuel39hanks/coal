import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/privy';
import { errors, apiSuccess, apiError } from '@/lib/errors';

export async function POST(request: Request) {
    try {
        const user = await getAuthUser(request);
        if (!user) return errors.unauthorized();

        const body = await request.json().catch(() => ({}));
        const { token } = body;

        if (!token || typeof token !== 'string') {
            return errors.validation({ token: ['Token is required'] });
        }

        // Find matching invite — search all team_invite records for this token
        const invites = await prisma.verification.findMany({
            where: {
                identifier: { startsWith: 'team_invite:' },
                expiresAt: { gt: new Date() },
            },
        });

        const invite = invites.find(i => {
            try {
                const val = JSON.parse(i.value);
                return val.token === token;
            } catch {
                return false;
            }
        });

        if (!invite) {
            return apiError('NOT_FOUND', 'Invite not found — it may have expired or already been used', 404);
        }

        const { merchantId, role, invitedBy } = JSON.parse(invite.value);

        // Check if already a member
        const existing = await prisma.teamMember.findUnique({
            where: { merchantId_userId: { merchantId, userId: user.id } },
        });

        // Delete the invite regardless
        await prisma.verification.delete({ where: { id: invite.id } }).catch(() => null);

        if (existing) {
            return apiSuccess({ alreadyMember: true, merchantId });
        }

        const membership = await prisma.teamMember.create({
            data: { merchantId, userId: user.id, role, invitedBy },
            include: {
                user: { select: { id: true, name: true, email: true } },
            },
        });

        return apiSuccess({
            id: membership.id,
            role: membership.role,
            merchantId,
            alreadyMember: false,
        }, 201);
    } catch {
        return errors.internal();
    }
}
