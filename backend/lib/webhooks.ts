import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { webhookLogger } from '@/lib/logger';

export async function sendWebhook(
    url: string,
    payload: any,
    secret: string,
    merchantId?: string
): Promise<boolean> {
    // Create event record for delivery tracking (only if merchantId provided)
    let eventId: string | null = null;
    if (merchantId) {
        try {
            const event = await prisma.webhookEvent.create({
                data: {
                    merchantId,
                    eventType: payload.event || 'unknown',
                    payload,
                    url,
                    status: 'pending',
                }
            });
            eventId = event.id;
        } catch (err) {
            webhookLogger.warn({ err }, 'Could not create webhook event record');
        }
    }

    try {
        const timestamp = Date.now().toString();
        const body = JSON.stringify(payload);
        const sig = crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Coal-Signature': `t=${timestamp},v1=${sig}`,
                ...(eventId ? {
                    'Coal-Event-Id': eventId,
                    'Coal-Event-Type': payload.event || 'unknown',
                    'Coal-Delivery-Attempt': '1',
                    'Idempotency-Key': eventId,
                } : {}),
                'User-Agent': 'Coal-Webhook/1.0',
            },
            body,
            signal: AbortSignal.timeout(10_000),
        });

        const success = response.ok;
        const responseBody = (await response.text()).slice(0, 500);

        if (eventId) {
            await prisma.webhookEvent.update({
                where: { id: eventId },
                data: {
                    status: success ? 'delivered' : 'failed',
                    attempts: 1,
                    lastAttemptAt: new Date(),
                    deliveredAt: success ? new Date() : null,
                    responseStatus: response.status,
                    responseBody,
                    nextRetryAt: success ? null : new Date(Date.now() + 30_000), // Retry in 30s
                }
            });
        }

        if (!success) webhookLogger.error({ status: response.status }, 'Webhook delivery failed');
        return success;
    } catch (error: any) {
        webhookLogger.error({ err: error }, 'Webhook send error');
        if (eventId) {
            await prisma.webhookEvent.update({
                where: { id: eventId },
                data: {
                    status: 'failed',
                    attempts: 1,
                    lastAttemptAt: new Date(),
                    errorMessage: error.message?.slice(0, 200),
                    nextRetryAt: new Date(Date.now() + 30_000),
                }
            }).catch(() => {});
        }
        return false;
    }
}
