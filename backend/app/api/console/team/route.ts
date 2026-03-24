import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/privy';
import { errors, apiSuccess } from '@/lib/errors';
import { rateLimiters, checkRateLimit } from '@/lib/rate-limit';
import { syncMerchantArtifacts } from '@/lib/0g/merchant';

const VALID_INVITE_ROLES = ['admin', 'member', 'viewer'] as const;
type InviteRole = typeof VALID_INVITE_ROLES[number];

export async function GET(request: Request) {
    try {
        const user = await getAuthUser(request);
        if (!user) return errors.unauthorized();

        const { limited } = await checkRateLimit(rateLimiters.console, user.id);
        if (limited) return errors.rateLimited();

        const members = await prisma.teamMember.findMany({
            where: { merchantId: user.id },
            include: {
                user: {
                    select: { id: true, name: true, email: true },
                },
            },
            orderBy: { createdAt: 'asc' },
        });

        return apiSuccess({
            members: members.map(m => ({
                id: m.id,
                role: m.role,
                createdAt: m.createdAt,
                user: {
                    id: m.user.id,
                    name: m.user.name,
                    email: m.user.email,
                },
            })),
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

        const body = await request.json().catch(() => ({}));
        const { email, role } = body;

        if (!email || typeof email !== 'string') {
            return errors.validation({ email: ['Email is required'] });
        }

        if (!role || !VALID_INVITE_ROLES.includes(role as InviteRole)) {
            return errors.validation({ role: ['Role must be one of: admin, member, viewer'] });
        }

        // Look up the user by email
        const targetUser = await prisma.user.findUnique({ where: { email } });
        if (!targetUser) {
            return errors.notFound('User — they must sign up first');
        }

        // Check if already a member
        const existing = await prisma.teamMember.findUnique({
            where: { merchantId_userId: { merchantId: user.id, userId: targetUser.id } },
        });
        if (existing) {
            return errors.conflict('CONFLICT', 'User is already a team member');
        }

        const membership = await prisma.teamMember.create({
            data: {
                merchantId: user.id,
                userId: targetUser.id,
                role,
                invitedBy: user.id,
            },
            include: {
                user: {
                    select: { id: true, name: true, email: true },
                },
            },
        });

        return apiSuccess({
            id: membership.id,
            role: membership.role,
            createdAt: membership.createdAt,
            user: {
                id: membership.user.id,
                name: membership.user.name,
                email: membership.user.email,
            },
            zeroG: await syncMerchantArtifacts(user.id).catch(() => null),
        }, 201);
    } catch {
        return errors.internal();
    }
}
