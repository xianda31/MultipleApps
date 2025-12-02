import { Injectable } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class EmailTemplateService {

    /**
     * Construit un email HTML complet avec en-tête et footer
     * @param bodyHtml Le contenu HTML personnalisé (sans <html>, <body>, etc.)
     * @returns Le HTML complet prêt à être envoyé
     */
    buildEmailTemplate(bodyHtml: string): string {
        return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Email</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px 0;">
    <tr>
      <td align="center">
        <!-- Container principal -->
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          
          <!-- En-tête -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">
                Bridge Club Saint-Orens
              </h1>
              <p style="margin: 10px 0 0 0; color: #ffffff; font-size: 14px; opacity: 0.9;">
                Votre club de bridge convivial et dynamique
              </p>
            </td>
          </tr>
          
          <!-- Corps du message (contenu personnalisé) -->
          <tr>
            <td style="padding: 40px 30px;">
              ${bodyHtml}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 30px; border-top: 1px solid #e0e0e0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="text-align: center;">
                    <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.6;">
                      <strong>Bridge Club Saint-Orens</strong><br>
                      📍 12 Avenue de Gameville, 31650 Saint-Orens-de-Gameville<br>
                      📧 contact@bridgeclubsaintorens.fr<br>
                      🌐 <a href="https://bridgeclubsaintorens.fr" style="color: #667eea; text-decoration: none;">bridgeclubsaintorens.fr</a>
                    </p>
                  </td>
                </tr>
              </table>
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
}
