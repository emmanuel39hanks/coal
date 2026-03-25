import { prisma } from '@/lib/prisma';
import { getCallerUser } from '@/lib/privy';
import { errors, apiSuccess } from '@/lib/errors';
import { rateLimiters, checkRateLimit } from '@/lib/rate-limit';

// GET /api/console/workspaces
// Returns the authenticated user's own workspace plus any workspaces they
// have been invited to as a team member, plus named workspaces they own.
export async function GET(request: Request) {
    try {
        const user = await getCallerUser(request);
        if (!user) return errors.unauthorized();

        const { limited } = await checkRateLimit(rateLimiters.console, user.id);
        if (limited) return errors.rateLimited();

        // Named workspaces this user created
        const ownedWorkspaces = await prisma.workspace.findMany({
            where: { ownerId: user.id },
            include: { user: { select: { id: true, name: true, email: true } } },
            orderBy: { createdAt: 'asc' },
        });

        // Team memberships (workspaces this user has been invited to)
        const memberships = await prisma.teamMember.findMany({
            where: { userId: user.id },
            include: {
                merchant: {
                    select: { id: true, name: true, email: true },
                },
            },
            orderBy: { createdAt: 'asc' },
        });

        const workspaces = [
            // Default workspace (own account) is always first
            {
                id: user.id,
                name: user.name || user.email.split('@')[0],
                email: user.email,
                role: 'owner' as const,
                isOwn: true,
                isDefault: true,
            },
            // Named workspaces owned by this user
            ...ownedWorkspaces.map((w: { id: string; userId: string; name: string; user: { email: string } }) => ({
                id: w.userId,         // sub-user id — used as x-workspace-id
                workspaceId: w.id,    // Workspace record id
                name: w.name,
                email: w.user.email,
                role: 'owner' as const,
                isOwn: true,
                isDefault: false,
            })),
            // Guest workspaces (team memberships)
            ...memberships.map(m => ({
                id: m.merchantId,
                name: m.merchant.name || m.merchant.email.split('@')[0],
                email: m.merchant.email,
                role: m.role,
                isOwn: false,
                isDefault: false,
            })),
        ];

        return apiSuccess({ workspaces });
    } catch {
        return errors.internal();
    }
}

// POST /api/console/workspaces
// Create a new named workspace under the authenticated user.
export async function POST(request: Request) {
    try {
        const user = await getCallerUser(request);
        if (!user) return errors.unauthorized();

        const { limited } = await checkRateLimit(rateLimiters.console, user.id);
        if (limited) return errors.rateLimited();

        const body = await request.json().catch(() => ({}));
        const name = (body.name ?? '').trim();
        if (!name) return errors.validation({ name: 'Workspace name is required' });
        if (name.length > 60) return errors.validation({ name: 'Workspace name must be 60 characters or less' });

        // Create a sub-user that acts as the merchant entity for this workspace.
        // Using coal.internal domain so it never conflicts with real user emails.
        const workspaceRecord = await prisma.workspace.create({
            data: {
                name,
                owner: {
                    connect: { id: user.id },
                },
                user: {
                    create: {
                        // Placeholder email replaced after we know the workspace id
                        email: `ws_placeholder_${Date.now()}@coal.internal`,
                        name,
                        emailVerified: true,
                        onboardingComplete: true, // sub-accounts skip onboarding
                    },
                },
            },
            include: { user: true },
        });

        // Update email to use stable workspace id
        await prisma.user.update({
            where: { id: workspaceRecord.userId },
            data: { email: `ws_${workspaceRecord.id}@coal.internal` },
        });

        return apiSuccess({
            id: workspaceRecord.userId,      // use as x-workspace-id
            workspaceId: workspaceRecord.id,
            name,
        }, 201);
    } catch {
        return errors.internal();
    }
}
