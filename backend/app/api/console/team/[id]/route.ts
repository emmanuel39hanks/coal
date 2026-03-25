import { prisma } from '@/lib/prisma';
import { getAuthUser, type CoalUser } from '@/lib/privy';
import { errors, apiSuccess } from '@/lib/errors';
import { syncMerchantArtifacts } from '@/lib/0g/merchant';

const VALID_ROLES = ['admin', 'member', 'viewer'] as const;
type ValidRole = typeof VALID_ROLES[number];

function getCallerId(user: CoalUser): string {
    return user._callerId ?? user.id;
}

function isActualOwner(user: CoalUser): boolean {
    return !user._callerId;
}

async function getCallerMembership(merchantId: string, cid: string) {
    return prisma.teamMember.findUnique({
        where: { merchantId_userId: { merchantId, userId: cid } },
    });
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getAuthUser(request);
        if (!user) return errors.unauthorized();

        const { id } = await params;

        const member = await prisma.teamMember.findUnique({
            where: { id },
            include: { user: { select: { id: true, name: true, email: true } } },
        });

        if (!member) return errors.notFound('Team member');

        const cid = getCallerId(user);
        const ownerCheck = isActualOwner(user) && member.merchantId === user.id;
        if (!ownerCheck) {
            const callerMembership = await getCallerMembership(member.merchantId, cid);
            if (!callerMembership || !['owner', 'admin'].includes(callerMembership.role)) {
                return errors.forbidden();
            }
        }

        if (member.role === 'owner') {
            return errors.forbidden("Cannot change the owner's role");
        }

        const body = await request.json().catch(() => ({}));
        const { role } = body;

        if (!role || !VALID_ROLES.includes(role as ValidRole)) {
            return errors.validation({ role: ['Role must be one of: admin, member, viewer'] });
        }

        const updated = await prisma.teamMember.update({
            where: { id },
            data: { role },
            include: { user: { select: { id: true, name: true, email: true } } },
        });

        // Fire-and-forget 0G sync
        syncMerchantArtifacts(updated.merchantId).catch(() => null);

        return apiSuccess({
            id: updated.id,
            role: updated.role,
            createdAt: updated.createdAt,
            user: { id: updated.user.id, name: updated.user.name, email: updated.user.email },
        });
    } catch {
        return errors.internal();
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getAuthUser(request);
        if (!user) return errors.unauthorized();

        const { id } = await params;

        // --- Case 1: Confirmed team member ---
        const member = await prisma.teamMember.findUnique({ where: { id } });
        if (member) {
            const cid = getCallerId(user);
            const ownerCheck = isActualOwner(user) && member.merchantId === user.id;
            if (!ownerCheck) {
                const callerMembership = await getCallerMembership(member.merchantId, cid);
                if (!callerMembership || !['owner', 'admin'].includes(callerMembership.role)) {
                    return errors.forbidden();
                }
            }
            if (member.role === 'owner') {
                return errors.forbidden('Cannot remove the owner from the team');
            }
            await prisma.teamMember.delete({ where: { id } });
            // Fire-and-forget 0G sync
            syncMerchantArtifacts(member.merchantId).catch(() => null);
            return apiSuccess({ success: true });
        }

        // --- Case 2: Pending invite (Verification record) ---
        const invite = await prisma.verification.findUnique({ where: { id } });
        if (invite && invite.identifier.endsWith(`:${user.id}`)) {
            // Only owner/admin may revoke invites
            const callerRole = (user as CoalUser)._callerRole;
            if (callerRole && !['owner', 'admin'].includes(callerRole)) {
                return errors.forbidden();
            }
            await prisma.verification.delete({ where: { id } });
            return apiSuccess({ success: true });
        }

        return errors.notFound('Team member');
    } catch {
        return errors.internal();
    }
}
