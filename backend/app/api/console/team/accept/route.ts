import { prisma } from '@/lib/prisma';
import { getCallerUser } from '@/lib/privy';
import { errors, apiSuccess, apiError } from '@/lib/errors';

export async function POST(request: Request) {
    try {
        // Always use the actual authenticated user — never workspace context —
        // because this endpoint is about the caller accepting their own invite.
        const user = await getCallerUser(request);
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
            // The verification record may have been cleaned up by the auto-accept
            // flow in getCallerUser (first-time signup). Check if the user is
            // already a team member of any workspace they were invited to.
            // We can't recover the merchantId from an expired/missing token, so
            // look for any recent membership created for this user.
            const recentMembership = await prisma.teamMember.findFirst({
                where: {
                    userId: user.id,
                    createdAt: { gt: new Date(Date.now() - 10 * 60 * 1000) }, // within last 10 min
                },
                orderBy: { createdAt: 'desc' },
            });
            if (recentMembership) {
                // Auto-accept already processed — return success
                return apiSuccess({ alreadyMember: true, merchantId: recentMembership.merchantId });
            }
            return apiError('NOT_FOUND', 'Invite not found — it may have expired or already been used', 404);
        }

        const { merchantId, role, invitedBy } = JSON.parse(invite.value);

        // Delete the invite record regardless (cleanup)
        await prisma.verification.delete({ where: { id: invite.id } }).catch(() => null);

        // Check if already a member (idempotent)
        const existing = await prisma.teamMember.findUnique({
            where: { merchantId_userId: { merchantId, userId: user.id } },
        });

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
