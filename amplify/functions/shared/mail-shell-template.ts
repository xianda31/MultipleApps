export interface ClubMailTemplateOptions {
  brandTitle?: string;
  tagline?: string;
  accentColor?: string;
  footerEmail?: string;
  footerWebsite?: string;
}

export function buildClubMailTemplate(bodyHtml: string, options: ClubMailTemplateOptions = {}): string {
  const brandTitle = options.brandTitle || 'Bridge Club Saint-Orens';
  const tagline = options.tagline || 'Confirmation de votre achat';
  const accentColor = options.accentColor || '#2b8a3e';
  const footerEmail = options.footerEmail || 'bridge.saintorens@free.fr';
  const footerWebsite = options.footerWebsite || 'https://bridgeclubsaintorens.fr';

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background-color:#f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;padding:20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
          <tr>
            <td style="background-color:${accentColor};padding:30px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:bold;">${brandTitle}</h1>
              <p style="margin:10px 0 0 0;color:#ffffff;font-size:14px;">${tagline}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 30px;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="background-color:#f8f9fa;padding:30px;border-top:1px solid #e0e0e0;">
              <p style="margin:0;color:#666666;font-size:14px;line-height:1.6;text-align:center;">
                <strong>${brandTitle}</strong><br>
                13 boulevard du libre échange, 31650 Saint-Orens-de-Gameville<br>
                <a href="mailto:${footerEmail}" style="color:${accentColor};text-decoration:none;">${footerEmail}</a><br>
                <a href="${footerWebsite}" style="color:${accentColor};text-decoration:none;">${footerWebsite}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();
}