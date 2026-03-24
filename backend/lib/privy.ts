import { PrivyClient } from '@privy-io/server-auth';
import { prisma } from '@/lib/prisma';

const privyClient = new PrivyClient(
  process.env.PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!
);

export async function getAuthUser(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);

  try {
    const verifiedClaims = await privyClient.verifyAuthToken(token);
    const privyDid = verifiedClaims.userId;

    // Find existing user
    let user = await prisma.user.findUnique({ where: { privyDid } });
    if (user) return user;

    // First login — create Coal user from Privy profile
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
        emailVerified: true, // Privy handles email verification
      },
    });

    // Auto-accept any pending team invites for this email
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
        // ignore duplicate or parse errors
      }
    }

    if (pendingInvites.length > 0) {
      await prisma.verification.deleteMany({
        where: { identifier: { startsWith: `team_invite:${email}:` } },
      });
    }

    return newUser;
  } catch {
    return null;
  }
}
