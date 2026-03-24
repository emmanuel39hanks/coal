import { Resend } from 'resend';
import { logger } from './logger';

const FROM_ADDRESS = process.env.EMAIL_FROM || 'Coal <noreply@usecoal.xyz>';
const REPLY_TO = process.env.EMAIL_REPLY_TO || 'support@usecoal.xyz';

let resendClient: Resend | null = null;

function getResendClient(): Resend | null {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return null;

    if (!resendClient) {
        resendClient = new Resend(apiKey);
    }

    return resendClient;
}

export interface SendEmailOptions {
    to: string;
    subject: string;
    html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailOptions): Promise<boolean> {
    const resend = getResendClient();

    if (!resend) {
        logger.warn({ to, subject }, 'Email skipped — RESEND_API_KEY not set');
        return false;
    }

    try {
        const { error } = await resend.emails.send({
            from: FROM_ADDRESS,
            replyTo: REPLY_TO,
            to,
            subject,
            html,
        });

        if (error) {
            logger.error({ error, to, subject }, 'Failed to send email');
            return false;
        }

        logger.info({ to, subject }, 'Email sent');
        return true;
    } catch (err) {
        logger.error({ err, to, subject }, 'Email send threw');
        return false;
    }
}
