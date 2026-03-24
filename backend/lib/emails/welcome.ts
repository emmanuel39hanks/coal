import { emailShell, badge, ctaButton, heading, para, divider } from './base';
import { sendEmail } from '../email';

interface WelcomeOptions {
    merchantEmail: string;
    merchantName?: string;
}

export function welcomeHtml(opts: WelcomeOptions): string {
    const { merchantName } = opts;
    const firstName = merchantName?.split(' ')[0] || 'there';

    const steps = [
        { n: '1', title: 'Set your payout address', body: 'Add your Base wallet address in Console → Settings. This is where all payments land — directly, instantly.' },
        { n: '2', title: 'Create a product', body: 'Add a product with a name, price, and optional image. Attach it to a payment link for a ready-made checkout page.' },
        { n: '3', title: 'Share your payment link', body: 'Copy your link and send it anywhere — email, Notion, social, QR code. Your customers pay in any token.' },
    ];

    const stepsHtml = steps.map(s => `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:16px;">
      <tr>
        <td width="40" valign="top" style="padding-top:2px;">
          <div style="width:32px;height:32px;background-color:#180D43;border-radius:50%;text-align:center;line-height:32px;font-size:13px;font-weight:900;color:#FF5C16;border:2px solid #FF5C16;">${s.n}</div>
        </td>
        <td style="padding-left:12px;">
          <p style="margin:0 0 2px;font-size:14px;font-weight:800;color:#180D43;">${s.title}</p>
          <p style="margin:0;font-size:13px;line-height:1.6;color:#5C5C5C;">${s.body}</p>
        </td>
      </tr>
    </table>`).join('');

    const body = `
    ${badge('Welcome to Coal', '#FF5C16', '#FFF4F0')}
    <div style="height:20px;"></div>

    ${heading(`Hey ${firstName}, you're in. 👋`)}
    ${para('Coal is your non-custodial crypto payment layer — accept any token, any chain, settle directly to your wallet in seconds.')}

    <div style="background-color:#F5F2ED;border-radius:16px;padding:20px 20px 8px;margin:20px 0;">
      ${stepsHtml}
    </div>

    ${ctaButton('Open your Console →', 'https://usecoal.xyz/console')}

    ${divider}

    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
      <tr>
        <td width="50%" style="padding-right:8px;">
          <div style="background-color:#F5F2ED;border-radius:12px;padding:16px;">
            <p style="margin:0 0 4px;font-size:12px;font-weight:800;color:#180D43;text-transform:uppercase;letter-spacing:0.06em;">Docs</p>
            <p style="margin:0 0 8px;font-size:12px;color:#5C5C5C;line-height:1.5;">API reference, quickstart, and integration guides.</p>
            <a href="https://usecoal.xyz/docs" style="font-size:12px;font-weight:700;color:#FF5C16;text-decoration:none;">Read docs →</a>
          </div>
        </td>
        <td width="50%" style="padding-left:8px;">
          <div style="background-color:#F5F2ED;border-radius:12px;padding:16px;">
            <p style="margin:0 0 4px;font-size:12px;font-weight:800;color:#180D43;text-transform:uppercase;letter-spacing:0.06em;">Live Demo</p>
            <p style="margin:0 0 8px;font-size:12px;color:#5C5C5C;line-height:1.5;">See a real paywall, split payment, and checkout in action.</p>
            <a href="https://usecoal.xyz/demo" style="font-size:12px;font-weight:700;color:#FF5C16;text-decoration:none;">Try demo →</a>
          </div>
        </td>
      </tr>
    </table>

    <div style="height:20px;"></div>
    ${para('Questions? Reply to this email — we read every one.', true)}
    `;

    return emailShell({
        preheader: `Welcome to Coal, ${firstName}. Here's how to start accepting crypto payments in 3 steps.`,
        body,
    });
}

export async function sendWelcome(opts: WelcomeOptions) {
    return sendEmail({
        to: opts.merchantEmail,
        subject: `Welcome to Coal — let's get you paid`,
        html: welcomeHtml(opts),
    });
}
