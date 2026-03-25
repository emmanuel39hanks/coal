import { prisma } from '@/lib/prisma';
import { errors, apiSuccess } from '@/lib/errors';
import crypto from 'crypto';

async function attemptDelivery(eventId: string): Promise<void> {
    const event = await prisma.webhookEvent.findUnique({
        where: { id: eventId },
        include: { merchant: { select: { webhookSecret: true } } }
    });
    if (!event || event.status === 'delivered' || event.status === 'exhausted') return;

    const secret = event.merchant.webhookSecret;
    if (!secret) {
        await prisma.webhookEvent.update({
            where: { id: eventId },
            data: { status: 'exhausted', errorMessage: 'No webhook secret configured' }
        });
        return;
    }

    const now = new Date();
    const timestamp = now.getTime().toString();
    const body = JSON.stringify(event.payload);
    const sig = crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');

    let responseStatus: number | null = null;
    let responseBody: string | null = null;
    let errorMessage: string | null = null;
    let delivered = false;

    try {
        const res = await fetch(event.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Coal-Signature': `t=${timestamp},v1=${sig}`,
                'Coal-Event-Id': event.id,
                'Coal-Event-Type': event.eventType,
                'Coal-Delivery-Attempt': String(event.attempts + 1),
                'Idempotency-Key': event.id,
                'User-Agent': 'Coal-Webhook/1.0',
            },
            body,
            signal: AbortSignal.timeout(10_000),
        });
        responseStatus = res.status;
        responseBody = (await res.text()).slice(0, 500);
        delivered = res.ok;
    } catch (err: any) {
        errorMessage = err.message?.slice(0, 200) || 'Network error';
    }

    const newAttempts = event.attempts + 1;
    const BACKOFF_SECONDS = [30, 300, 1800, 7200, 86400]; // 30s, 5m, 30m, 2h, 24h
    const nextRetryDelay = BACKOFF_SECONDS[newAttempts - 1] ?? null;
    const exhausted = newAttempts >= event.maxAttempts || nextRetryDelay === null;

    await prisma.webhookEvent.update({
        where: { id: eventId },
        data: {
            attempts:      newAttempts,
            lastAttemptAt: now,
            status:        delivered ? 'delivered' : exhausted ? 'exhausted' : 'failed',
            deliveredAt:   delivered ? now : null,
            nextRetryAt:   (!delivered && !exhausted && nextRetryDelay)
                ? new Date(Date.now() + nextRetryDelay * 1000)
                : null,
            responseStatus,
            responseBody,
            errorMessage,
        }
    });
}

export async function POST(request: Request) {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
        return errors.unauthorized();
    }

    const due = await prisma.webhookEvent.findMany({
        where: {
            status: { in: ['pending', 'failed'] },
            nextRetryAt: { lte: new Date() },
        },
        take: 20,
    });

    let processed = 0;
    for (const event of due) {
        await attemptDelivery(event.id);
        processed++;
    }

    return apiSuccess({ processed });
}
