import { emailShell, badge, ctaButton, heading, para, divider } from './base';
import { sendEmail } from '../email';

interface TeamInviteOptions {
    inviteeEmail: string;
    inviterName: string;
    merchantName: string;
    role: string;
    inviteUrl: string;
    expiresInHours?: number;
}

export function teamInviteHtml(opts: TeamInviteOptions): string {
    const {
        inviterName,
        merchantName,
        role,
        inviteUrl,
        expiresInHours = 48,
    } = opts;

    const roleColors: Record<string, { bg: string; color: string }> = {
        owner:  { bg: '#FFF4F0', color: '#FF5C16' },
        admin:  { bg: '#EEF2FF', color: '#4362D1' },
        member: { bg: '#F0FDF4', color: '#16A34A' },
        viewer: { bg: '#F5F2ED', color: '#5C5C5C' },
    };
    const rc = roleColors[role.toLowerCase()] ?? roleColors.member;

    const body = `
    ${badge(`Invited as ${role.charAt(0).toUpperCase() + role.slice(1)}`, rc.color, rc.bg)}
    <div style="height:20px;"></div>

    ${heading(`You're invited to join ${merchantName}`)}
    ${para(`<strong>${inviterName}</strong> has invited you to join the <strong>${merchantName}</strong> workspace on Coal as a <strong>${role}</strong>.`)}

    <div style="background-color:#F5F2ED;border-radius:16px;padding:20px;margin:20px 0;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        <tr>
          <td>
            <div style="width:44px;height:44px;background-color:#180D43;border-radius:50%;text-align:center;line-height:44px;font-size:18px;font-weight:900;color:#FF5C16;margin-bottom:12px;">
              ${merchantName.charAt(0).toUpperCase()}
            </div>
            <p style="margin:0 0 2px;font-size:15px;font-weight:800;color:#180D43;">${merchantName}</p>
            <p style="margin:0;font-size:12px;color:#5C5C5C;">Coal merchant workspace</p>
          </td>
          <td align="right" valign="middle">
            <span style="display:inline-block;padding:6px 14px;background-color:${rc.bg};color:${rc.color};font-size:12px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;border-radius:100px;border:1.5px solid ${rc.color};">${role}</span>
          </td>
        </tr>
      </table>
    </div>

    ${ctaButton('Accept invitation →', inviteUrl)}

    ${divider}
    ${para(`This invitation expires in ${expiresInHours} hours. If you weren't expecting this, you can safely ignore this email.`, true)}
    `;

    return emailShell({
        preheader: `${inviterName} invited you to join ${merchantName} on Coal as ${role}.`,
        body,
    });
}

export async function sendTeamInvite(opts: TeamInviteOptions) {
    return sendEmail({
        to: opts.inviteeEmail,
        subject: `${opts.inviterName} invited you to ${opts.merchantName} on Coal`,
        html: teamInviteHtml(opts),
    });
}
