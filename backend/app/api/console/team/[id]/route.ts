import { prisma } from '@/lib/prisma';
import { getAuthUser, type CoalUser } from '@/lib/privy';
import { errors, apiSuccess } from '@/lib/errors';
import { syncMerchantArtifacts } from '@/lib/0g/merchant';

const VALID_ROLES = ['admin', 'member', 'viewer'] as const;
type ValidRole = typeof VALID_ROLES[number];

// Returns the real caller's user ID — the authenticated person, not the workspace proxy
function getCallerId(user: CoalUser): string {
    return user._callerId ?? user.id;
}

// Returns true only if the caller IS the actual workspace owner (not a team member)
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

        // Authorization: actual workspace owner OR admin team member of the same merchant
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

        const zeroG = await syncMerchantArtifacts(updated.merchantId).catch(() => null);

        return apiSuccess({
            id: updated.id,
            role: updated.role,
            createdAt: updated.createdAt,
            user: { id: updated.user.id, name: updated.user.name, email: updated.user.email },
            zeroG,
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

        const member = await prisma.teamMember.findUnique({ where: { id } });
        if (!member) return errors.notFound('Team member');

        // Authorization: actual workspace owner OR admin team member
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
        const zeroG = await syncMerchantArtifacts(member.merchantId).catch(() => null);

        return apiSuccess({ success: true, zeroG });
    } catch {
        return errors.internal();
    }
}
