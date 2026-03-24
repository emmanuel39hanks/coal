import { emailShell, badge, statBox, ctaButton, heading, para, divider } from './base';
import { sendEmail } from '../email';

interface ApiKeyCreatedOptions {
    merchantEmail: string;
    merchantName?: string;
    keyName: string;
    keyPrefix: string; // e.g. "pk_live_abc12..."
    createdAt: string;
    ipAddress?: string;
}

export function apiKeyCreatedHtml(opts: ApiKeyCreatedOptions): string {
    const { merchantName, keyName, keyPrefix, createdAt, ipAddress } = opts;
    const firstName = merchantName?.split(' ')[0] || 'there';

    const body = `
    ${badge('Security Notice', '#4362D1', '#EEF2FF')}
    <div style="height:20px;"></div>

    ${heading('New API key created')}
    ${para(`Hi ${firstName}, a new API key was just created on your Coal account.`)}

    ${statBox([
        { label: 'Key name', value: keyName },
        { label: 'Key prefix', value: keyPrefix, mono: true },
        { label: 'Created', value: new Date(createdAt).toUTCString() },
        ...(ipAddress ? [{ label: 'IP address', value: ipAddress }] : []),
    ])}

    <div style="background-color:#EEF2FF;border-radius:12px;padding:16px;margin:16px 0;border-left:4px solid #4362D1;">
      <p style="margin:0 0 4px;font-size:13px;font-weight:800;color:#1E3A8A;">Wasn't you?</p>
      <p style="margin:0;font-size:13px;color:#1E40AF;line-height:1.6;">If you didn't create this key, revoke it immediately from your console and contact us at <a href="mailto:security@usecoal.xyz" style="color:#FF5C16;font-weight:700;text-decoration:none;">security@usecoal.xyz</a>.</p>
    </div>

    ${ctaButton('Manage API keys →', 'https://usecoal.xyz/console/keys')}

    ${divider}
    ${para('API keys grant full access to your merchant account. Never share them publicly or commit them to version control.', true)}
    `;

    return emailShell({
        preheader: `A new API key "${keyName}" was created on your Coal account.`,
        body,
    });
}

export async function sendApiKeyCreated(opts: ApiKeyCreatedOptions) {
    return sendEmail({
        to: opts.merchantEmail,
        subject: `New API key created: ${opts.keyName}`,
        html: apiKeyCreatedHtml(opts),
    });
}
