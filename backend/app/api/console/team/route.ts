import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { getAuthUser, type CoalUser } from '@/lib/privy';
import { errors, apiSuccess } from '@/lib/errors';
import { rateLimiters, checkRateLimit } from '@/lib/rate-limit';
import { syncMerchantArtifacts } from '@/lib/0g/merchant';
import { sendTeamInvite } from '@/lib/emails/teamInvite';

const VALID_INVITE_ROLES = ['admin', 'member', 'viewer'] as const;
type InviteRole = typeof VALID_INVITE_ROLES[number];

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Extract email from identifier `team_invite:{email}:{merchantId}`
function emailFromIdentifier(identifier: string): string {
    const withoutPrefix = identifier.replace(/^team_invite:/, '');
    const lastColon = withoutPrefix.lastIndexOf(':');
    return withoutPrefix.slice(0, lastColon);
}

export async function GET(request: Request) {
    try {
        const user = await getAuthUser(request);
        if (!user) return errors.unauthorized();

        const { limited } = await checkRateLimit(rateLimiters.console, user.id);
        if (limited) return errors.rateLimited();

        const [members, pendingInvites] = await Promise.all([
            prisma.teamMember.findMany({
                where: { merchantId: user.id },
                include: { user: { select: { id: true, name: true, email: true } } },
                orderBy: { createdAt: 'asc' },
            }),
            prisma.verification.findMany({
                where: {
                    identifier: { startsWith: 'team_invite:', endsWith: `:${user.id}` },
                    expiresAt: { gt: new Date() },
                },
                orderBy: { createdAt: 'asc' },
            }),
        ]);

        return apiSuccess({
            members: [
                ...members.map(m => ({
                    id: m.id,
                    role: m.role,
                    createdAt: m.createdAt,
                    pending: false as const,
                    user: { id: m.user.id, name: m.user.name, email: m.user.email },
                })),
                ...pendingInvites.map(inv => {
                    const { role } = JSON.parse(inv.value);
                    return {
                        id: inv.id,
                        role,
                        createdAt: inv.createdAt,
                        expiresAt: inv.expiresAt,
                        pending: true as const,
                        email: emailFromIdentifier(inv.identifier),
                    };
                }),
            ],
        });
    } catch {
        return errors.internal();
    }
}

export async function POST(request: Request) {
    try {
        const user = await getAuthUser(request);
        if (!user) return errors.unauthorized();

        const { limited } = await checkRateLimit(rateLimiters.console, user.id);
        if (limited) return errors.rateLimited();

        const callerRole = (user as CoalUser)._callerRole;
        if (callerRole && !['owner', 'admin'].includes(callerRole)) {
            return errors.forbidden('Only workspace owners and admins can invite team members');
        }

        const body = await request.json().catch(() => ({}));
        const { email, role } = body;

        if (!email || typeof email !== 'string') {
            return errors.validation({ email: ['Email is required'] });
        }
        if (!role || !VALID_INVITE_ROLES.includes(role as InviteRole)) {
            return errors.validation({ role: ['Role must be one of: admin, member, viewer'] });
        }

        // Block if already a confirmed team member
        const targetUser = await prisma.user.findUnique({ where: { email } });
        if (targetUser) {
            const existing = await prisma.teamMember.findUnique({
                where: { merchantId_userId: { merchantId: user.id, userId: targetUser.id } },
            });
            if (existing) {
                return errors.conflict('CONFLICT', 'User is already a team member');
            }
        }

        const inviterName = user.name || user.email.split('@')[0];
        const merchantName = user.name || 'Coal';
        const frontendUrl = (process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://usecoal.xyz').replace(/\/$/, '');

        // Always create a pending invite — everyone must accept via the invite link
        const token = crypto.randomBytes(32).toString('hex');

        await prisma.verification.deleteMany({
            where: { identifier: `team_invite:${email}:${user.id}` },
        });

        await prisma.verification.create({
            data: {
                identifier: `team_invite:${email}:${user.id}`,
                value: JSON.stringify({ token, merchantId: user.id, role, invitedBy: user.id, merchantName }),
                expiresAt: new Date(Date.now() + INVITE_TTL_MS),
            },
        });

        const inviteUrl = `${frontendUrl}/invite?token=${token}`;
        await sendTeamInvite({ inviteeEmail: email, inviterName, merchantName, role, inviteUrl, expiresInHours: 168 });

        // Fire-and-forget 0G sync — don't block the response
        syncMerchantArtifacts(user.id).catch(() => null);

        return apiSuccess({ pending: true, email, message: `Invite sent to ${email}.` }, 202);
    } catch {
        return errors.internal();
    }
}
