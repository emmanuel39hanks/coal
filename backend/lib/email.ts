import { Resend } from 'resend';
import { logger } from './logger';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_ADDRESS = process.env.EMAIL_FROM || 'Coal <noreply@usecoal.xyz>';
const REPLY_TO = process.env.EMAIL_REPLY_TO || 'support@usecoal.xyz';

export interface SendEmailOptions {
    to: string;
    subject: string;
    html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailOptions): Promise<boolean> {
    if (!process.env.RESEND_API_KEY) {
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
