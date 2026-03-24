import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/privy';
import crypto from 'crypto';
import { updateSettingsSchema, validateBody } from '@/lib/schemas';
import { errors, apiSuccess } from '@/lib/errors';
import { validateWebhookUrl } from '@/lib/ssrf';
import { logger } from '@/lib/logger';
import { syncMerchantArtifacts } from '@/lib/0g/merchant';

export async function GET(request: Request) {
    try {
        const user = await getAuthUser(request);
        if (!user) return errors.unauthorized();

        // Fetch fresh user — auto-generate webhookSecret if missing
        let dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: {
                name: true,
                email: true,
                payoutAddress: true,
                webhookSecret: true,
                webhookUrl: true,
            }
        });

        if (!dbUser) return errors.notFound('User');

        // Auto-provision webhook secret for merchants that don't have one yet
        if (!dbUser.webhookSecret) {
            const generated = `whsec_${crypto.randomBytes(32).toString('hex')}`;
            dbUser = await prisma.user.update({
                where: { id: user.id },
                data: { webhookSecret: generated },
                select: { name: true, email: true, payoutAddress: true, webhookSecret: true, webhookUrl: true }
            });
        }

        // Mask the secret — show only last 4 chars
        const raw = dbUser.webhookSecret!;
        const masked = `${raw.slice(0, 10)}...${raw.slice(-4)}`;

        return apiSuccess({
            name: dbUser.name,
            email: dbUser.email,
            payoutAddress: dbUser.payoutAddress,
            webhookSecretMasked: masked,
            webhookUrl: dbUser.webhookUrl,
        });

    } catch (error) {
        return errors.internal();
    }
}

export async function PUT(request: Request) {
    try {
        const user = await getAuthUser(request);
        if (!user) return errors.unauthorized();

        const body = await request.json().catch(() => ({}));
        const validated = validateBody(updateSettingsSchema, body);
        if (!validated.success) return validated.error;

        const { name, payoutAddress, webhookUrl } = validated.data;

        if (webhookUrl) {
            const urlCheck = validateWebhookUrl(webhookUrl);
            if (!urlCheck.valid) {
                return errors.validation({ webhookUrl: [urlCheck.reason || 'Invalid webhook URL'] });
            }
        }

        const updated = await prisma.user.update({
            where: { id: user.id },
            data: {
                name:         name         !== undefined ? name         : undefined,
                payoutAddress: payoutAddress !== undefined ? payoutAddress : undefined,
                webhookUrl:   webhookUrl   !== undefined ? (webhookUrl || null) : undefined,
            },
            select: { name: true, email: true, payoutAddress: true, webhookUrl: true }
        });

        const merchantSync = await syncMerchantArtifacts(user.id).catch(() => null);

        return apiSuccess({
            ...updated,
            zeroG: merchantSync,
        });

    } catch (error) {
        logger.error({ err: error }, 'Update settings error');
        return errors.internal();
    }
}
