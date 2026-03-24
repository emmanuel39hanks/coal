import { emailShell, badge, statBox, ctaButton, heading, para, divider } from './base';
import { sendEmail } from '../email';

interface WebhookFailedOptions {
    merchantEmail: string;
    webhookUrl: string;
    eventType: string;
    failureReason: string;
    attemptCount: number;
    nextRetryAt?: string;
    sessionId?: string;
}

export function webhookFailedHtml(opts: WebhookFailedOptions): string {
    const {
        webhookUrl,
        eventType,
        failureReason,
        attemptCount,
        nextRetryAt,
        sessionId,
    } = opts;

    const maxAttempts = 5;
    const isExhausted = attemptCount >= maxAttempts;
    const shortUrl = webhookUrl.length > 50 ? `${webhookUrl.slice(0, 47)}...` : webhookUrl;

    const body = `
    ${badge(isExhausted ? 'Webhook Failed — Retries Exhausted' : `Webhook Failing — Attempt ${attemptCount}/${maxAttempts}`, '#DC2626', '#FEF2F2')}
    <div style="height:20px;"></div>

    ${heading(isExhausted ? 'Your webhook is not receiving events' : 'Webhook delivery failed')}
    ${para(
        isExhausted
            ? `Coal has tried to deliver the <strong>${eventType}</strong> event <strong>${attemptCount} times</strong> and all attempts failed. No further retries will be made for this event.`
            : `Coal couldn't deliver the <strong>${eventType}</strong> event to your endpoint. We'll keep retrying automatically.`
    )}

    ${statBox([
        { label: 'Event', value: eventType },
        { label: 'Endpoint', value: shortUrl, mono: true },
        { label: 'Attempts', value: `${attemptCount} of ${maxAttempts}` },
        { label: 'Reason', value: failureReason },
        ...(sessionId ? [{ label: 'Session ID', value: sessionId, mono: true }] : []),
        ...(nextRetryAt && !isExhausted ? [{ label: 'Next retry', value: nextRetryAt }] : []),
    ])}

    ${isExhausted ? `
    <div style="background-color:#FEF2F2;border-radius:12px;padding:16px;margin:16px 0;border-left:4px solid #DC2626;">
      <p style="margin:0;font-size:13px;font-weight:700;color:#991B1B;">Action required: check your endpoint</p>
      <p style="margin:6px 0 0;font-size:13px;color:#7F1D1D;line-height:1.6;">Ensure your server is reachable, returns a 2xx status within 10 seconds, and your webhook secret is correctly set.</p>
    </div>` : `
    <div style="background-color:#FFFBEB;border-radius:12px;padding:16px;margin:16px 0;border-left:4px solid #F59E0B;">
      <p style="margin:0;font-size:13px;font-weight:700;color:#92400E;">Retry schedule</p>
      <p style="margin:6px 0 0;font-size:13px;color:#78350F;line-height:1.6;">Retries at: 1m → 5m → 30m → 2h → 8h. After 5 failed attempts, the event is marked failed.</p>
    </div>`}

    ${ctaButton('Review webhook settings →', 'https://usecoal.xyz/console/settings')}

    ${divider}
    ${para('Make sure your endpoint returns <code style="background:#F5F2ED;padding:2px 6px;border-radius:4px;font-family:monospace;font-size:12px;">200 OK</code> quickly and verify signatures with your webhook secret.', true)}
    <p style="margin:0;font-size:13px;color:#5C5C5C;">See <a href="https://usecoal.xyz/docs/webhooks/signatures" style="color:#FF5C16;font-weight:700;text-decoration:none;">signature verification docs →</a></p>
    `;

    return emailShell({
        preheader: `Webhook delivery failed for ${eventType} after ${attemptCount} attempt${attemptCount > 1 ? 's' : ''}.`,
        body,
    });
}

export async function sendWebhookFailed(opts: WebhookFailedOptions) {
    const isExhausted = opts.attemptCount >= 5;
    return sendEmail({
        to: opts.merchantEmail,
        subject: isExhausted
            ? `⚠️ Webhook failed after ${opts.attemptCount} attempts — ${opts.eventType}`
            : `Webhook delivery failed (attempt ${opts.attemptCount}/5) — ${opts.eventType}`,
        html: webhookFailedHtml(opts),
    });
}
