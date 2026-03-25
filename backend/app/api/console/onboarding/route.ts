import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/privy';
import { errors, apiSuccess } from '@/lib/errors';
import { syncMerchantArtifacts } from '@/lib/0g/merchant';

export async function GET(request: Request) {
    try {
        const user = await getAuthUser(request);
        if (!user) return errors.unauthorized();

        const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { onboardingStep: true, onboardingComplete: true },
        });

        if (!dbUser) return errors.notFound('User');

        // Team members and workspace sub-users skip onboarding — mark complete if not already
        if (!dbUser.onboardingComplete) {
            const isMember = await prisma.teamMember.findFirst({ where: { userId: user.id } });
            if (isMember) {
                await prisma.user.update({
                    where: { id: user.id },
                    data: { onboardingComplete: true, onboardingStep: 7 },
                });
                return apiSuccess({ step: 7, complete: true });
            }
        }

        return apiSuccess({
            step: dbUser.onboardingComplete ? 7 : dbUser.onboardingStep,
            complete: dbUser.onboardingComplete,
        });
    } catch {
        return errors.internal();
    }
}

export async function POST(request: Request) {
    try {
        const user = await getAuthUser(request);
        if (!user) return errors.unauthorized();

        const body = await request.json().catch(() => ({}));
        const { step } = body;

        if (!Number.isInteger(step) || step < 0 || step > 7) {
            return errors.validation({ step: ['Must be an integer between 0 and 7'] });
        }

        const existing = await prisma.user.findUnique({
            where: { id: user.id },
            select: { onboardingStep: true, onboardingComplete: true },
        });

        if (!existing) return errors.notFound('User');

        // Never allow stale clients or multi-tab sessions to regress onboarding state.
        const nextComplete = existing.onboardingComplete || step === 7;
        const nextStep = nextComplete ? 7 : Math.max(existing.onboardingStep, step);

        const updated = await prisma.user.update({
            where: { id: user.id },
            data: {
                onboardingStep: nextStep,
                onboardingComplete: nextComplete,
            },
            select: { onboardingStep: true, onboardingComplete: true },
        });

        const zeroG = await syncMerchantArtifacts(user.id).catch(() => null);

        return apiSuccess({
            step: updated.onboardingStep,
            complete: updated.onboardingComplete,
            zeroG,
        });
    } catch {
        return errors.internal();
    }
}
