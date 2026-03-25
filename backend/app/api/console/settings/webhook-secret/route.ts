import { prisma } from '@/lib/prisma';
import { getAuthUser, isWorkspaceOwner } from '@/lib/privy';
import crypto from 'crypto';
import { logger } from '@/lib/logger';
import { errors, apiSuccess } from '@/lib/errors';
import { syncMerchantArtifacts } from '@/lib/0g/merchant';

/**
 * POST /api/console/settings/webhook-secret
 *
 * Regenerates the merchant's webhook signing secret.
 * Returns the full secret once — it cannot be retrieved again.
 */
export async function POST(request: Request) {
    try {
        const user = await getAuthUser(request);
        if (!user) return errors.unauthorized();
        if (!isWorkspaceOwner(user)) return errors.forbidden('Only the workspace owner can regenerate the webhook secret');

        const newSecret = `whsec_${crypto.randomBytes(32).toString('hex')}`;

        await prisma.user.update({
            where: { id: user.id },
            data: { webhookSecret: newSecret }
        });

        const zeroG = await syncMerchantArtifacts(user.id).catch(() => null);

        // Return full secret once — merchant must save it now
        return apiSuccess({
            webhookSecret: newSecret,
            warning: 'Save this secret now. It will not be shown again.',
            zeroG,
        });

    } catch (error) {
        logger.error({ err: error }, 'Regenerate webhook secret error');
        return errors.internal();
    }
}
