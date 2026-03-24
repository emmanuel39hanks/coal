/**
 * Base HTML shell for all Coal transactional emails.
 * Uses inline CSS only — email client compatible.
 *
 * Brand:
 *   Orange  #FF5C16
 *   Navy    #180D43
 *   Bg      #F5F2ED
 *   Text    #180D43
 *   Muted   #5C5C5C
 */

export function emailShell({
    preheader,
    body,
}: {
    preheader: string;
    body: string;
}): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Coal</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#F5F2ED;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">

  <!-- Preheader (hidden preview text) -->
  <div style="display:none;max-height:0;overflow:hidden;font-size:1px;color:#F5F2ED;">${preheader}&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;</div>

  <!-- Outer wrapper -->
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#F5F2ED;">
    <tr>
      <td align="center" style="padding:40px 16px;">

        <!-- Card -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:24px;border:2px solid #180D43;box-shadow:6px 6px 0px 0px #180D43;">

          <!-- Header -->
          <tr>
            <td style="padding:28px 36px 24px;border-bottom:2px solid #F5F2ED;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td>
                    <span style="font-size:24px;font-weight:900;color:#180D43;letter-spacing:-1px;">coal</span>
                    <span style="display:inline-block;width:8px;height:8px;background-color:#FF5C16;border-radius:50%;margin-left:2px;vertical-align:middle;"></span>
                  </td>
                  <td align="right">
                    <span style="font-size:11px;font-weight:700;color:#5C5C5C;letter-spacing:0.1em;text-transform:uppercase;">usecoal.xyz</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 36px 28px;">
              ${body}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 36px 28px;border-top:2px solid #F5F2ED;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td>
                    <p style="margin:0 0 4px;font-size:12px;color:#5C5C5C;font-weight:600;">Coal · Non-custodial crypto payments</p>
                    <p style="margin:0;font-size:11px;color:#9CA3AF;">
                      <a href="https://usecoal.xyz/docs" style="color:#9CA3AF;text-decoration:none;">Docs</a>
                      &nbsp;·&nbsp;
                      <a href="https://usecoal.xyz/console" style="color:#9CA3AF;text-decoration:none;">Console</a>
                      &nbsp;·&nbsp;
                      <a href="https://usecoal.xyz/privacy" style="color:#9CA3AF;text-decoration:none;">Privacy</a>
                    </p>
                  </td>
                  <td align="right">
                    <p style="margin:0;font-size:11px;color:#D1D5DB;">Built on Base</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
        <!-- /Card -->

      </td>
    </tr>
  </table>

</body>
</html>`;
}

/** Orange pill badge */
export function badge(text: string, color = '#FF5C16', bg = '#FFF4F0'): string {
    return `<span style="display:inline-block;padding:4px 12px;background-color:${bg};color:${color};font-size:11px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;border-radius:100px;border:1.5px solid ${color};">${text}</span>`;
}

/** Dark stat box (amount, tx hash, etc.) */
export function statBox(rows: { label: string; value: string; mono?: boolean }[]): string {
    const rowsHtml = rows.map(r => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #2D1F5E;">
          <span style="font-size:11px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.08em;">${r.label}</span>
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #2D1F5E;text-align:right;">
          <span style="font-size:13px;font-weight:700;color:#FFFFFF;${r.mono ? 'font-family:monospace;' : ''}">${r.value}</span>
        </td>
      </tr>`).join('');

    return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
      style="background-color:#180D43;border-radius:16px;padding:4px 20px;margin:20px 0;">
      <tr><td colspan="2" style="height:8px;"></td></tr>
      ${rowsHtml}
      <tr><td colspan="2" style="height:4px;"></td></tr>
    </table>`;
}

/** Orange CTA button */
export function ctaButton(text: string, href: string): string {
    return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;">
      <tr>
        <td style="border-radius:100px;background-color:#FF5C16;border:2px solid #180D43;box-shadow:3px 3px 0px 0px #180D43;">
          <a href="${href}" style="display:inline-block;padding:14px 32px;font-size:14px;font-weight:800;color:#ffffff;text-decoration:none;letter-spacing:-0.01em;">${text}</a>
        </td>
      </tr>
    </table>`;
}

/** Section heading */
export function heading(text: string): string {
    return `<h1 style="margin:0 0 8px;font-size:26px;font-weight:900;color:#180D43;letter-spacing:-0.5px;line-height:1.2;">${text}</h1>`;
}

/** Body paragraph */
export function para(text: string, muted = false): string {
    return `<p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:${muted ? '#5C5C5C' : '#180D43'};font-weight:${muted ? '400' : '500'};">${text}</p>`;
}

/** Divider */
export const divider = `<hr style="border:none;border-top:2px solid #F5F2ED;margin:24px 0;" />`;
