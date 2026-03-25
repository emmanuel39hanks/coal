import { PrivyClient } from '@privy-io/server-auth';
import { prisma } from '@/lib/prisma';
import type { User } from '@/generated/prisma/client';

const privyClient = new PrivyClient(
  process.env.PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!
);

// Augmented user type — when workspace context is active, _callerId is the
// actual authenticated user's ID and _callerRole is their role in the workspace.
export type CoalUser = User & {
  _callerId?: string;
  _callerRole?: string;
};

// ---------------------------------------------------------------------------
// getCallerUser — always returns the authenticated user, ignores workspace context.
// Use this for endpoints that need to know WHO is making the request
// (invite accept, workspace listing, etc.).
// ---------------------------------------------------------------------------
export async function getCallerUser(request: Request): Promise<User | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);

  try {
    const verifiedClaims = await privyClient.verifyAuthToken(token);
    const privyDid = verifiedClaims.userId;

    let user = await prisma.user.findUnique({ where: { privyDid } });
    if (user) return user;

    return _createUserFromPrivy(privyDid);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// getAuthUser — returns the EFFECTIVE merchant user.
// When `x-workspace-id` header is present and the caller is a team member of
// that workspace, returns the workspace owner's user record (with _callerId
// and _callerRole attached). This lets all console endpoints use `user.id`
// as the merchantId without any code changes.
// ---------------------------------------------------------------------------
export async function getAuthUser(request: Request): Promise<CoalUser | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);

  try {
    const verifiedClaims = await privyClient.verifyAuthToken(token);
    const privyDid = verifiedClaims.userId;

    let user = await prisma.user.findUnique({ where: { privyDid } });
    if (!user) {
      user = await _createUserFromPrivy(privyDid);
      if (!user) return null;
    }

    // Check workspace context
    const workspaceId = request.headers.get('x-workspace-id');
    if (workspaceId && workspaceId !== user.id) {
      // 1. Check if the caller owns a named workspace with this userId
      const ownedWorkspace = await prisma.workspace.findFirst({
        where: { userId: workspaceId, ownerId: user.id },
        include: { user: true },
      });
      if (ownedWorkspace) {
        return {
          ...ownedWorkspace.user,
          _callerId: user.id,
          _callerRole: 'owner',
        } as CoalUser;
      }

      // 2. Check team membership (existing behaviour)
      const membership = await prisma.teamMember.findUnique({
        where: { merchantId_userId: { merchantId: workspaceId, userId: user.id } },
        include: { merchant: true },
      });
      if (!membership) return null; // not a member of that workspace

      return {
        ...membership.merchant,
        _callerId: user.id,
        _callerRole: membership.role,
      } as CoalUser;
    }

    return user as CoalUser;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Internal helper — create a new Coal user on first Privy login.
// Auto-accepts any pending team invites for the new user's email, but does
// NOT delete the verification records so the invite page can still call
// /accept and receive a clean success response (alreadyMember: true).
// ---------------------------------------------------------------------------
async function _createUserFromPrivy(privyDid: string): Promise<User | null> {
  try {
    const privyUser = await privyClient.getUser(privyDid);
    const email = privyUser.email?.address
      ?? privyUser.google?.email
      ?? privyUser.apple?.email
      ?? `${privyDid}@privy.local`;

    // Check if user exists by email (migration path for existing Better Auth users)
    const existingByEmail = await prisma.user.findUnique({ where: { email } });
    if (existingByEmail) {
      return prisma.user.update({
        where: { email },
        data: { privyDid },
      });
    }

    // Create new user
    const newUser = await prisma.user.create({
      data: {
        privyDid,
        email,
        name: privyUser.google?.name ?? email.split('@')[0],
        payoutAddress: privyUser.wallet?.address ?? null,
        emailVerified: true,
      },
    });

    // Auto-accept any pending team invites for this email.
    // We create the TeamMember rows but intentionally leave the Verification
    // records so the invite page can still call /accept and get a proper
    // success response (alreadyMember: true handles idempotency).
    const pendingInvites = await prisma.verification.findMany({
      where: {
        identifier: { startsWith: `team_invite:${email}:` },
        expiresAt: { gt: new Date() },
      },
    });

    for (const invite of pendingInvites) {
      try {
        const { merchantId, role, invitedBy } = JSON.parse(invite.value);
        await prisma.teamMember.create({
          data: { merchantId, userId: newUser.id, role, invitedBy },
        });
      } catch {
        // Ignore duplicate or parse errors
      }
    }

    return newUser;
  } catch {
    return null;
  }
}
