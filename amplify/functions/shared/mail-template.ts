import { buildClubMailTemplate, ClubMailTemplateOptions } from './mail-shell-template';

export interface PurchaseConfirmationMailData {
  memberName?: string;
  amount: string;
  currency: string;
  receiptUrl?: string | null;
}

export function buildPurchaseConfirmationBodyHtml(data: PurchaseConfirmationMailData): string {
  const memberName = escapeHtml(String(data.memberName || '')) || 'cher membre';
  const amount = escapeHtml(String(data.amount || ''));
  const currency = escapeHtml(String(data.currency || ''));
  const receiptUrl = data.receiptUrl ? escapeHtml(String(data.receiptUrl)) : '';

  return `
    <h2 style="margin:0 0 16px 0;color:#1f2937;">Merci pour votre achat</h2>
    <p style="margin:0 0 12px 0;font-size:16px;line-height:1.6;color:#374151;">
      Bonjour ${memberName},
    </p>
    <p style="margin:0 0 12px 0;font-size:16px;line-height:1.6;color:#374151;">
      Votre paiement de <strong>${amount} ${currency}</strong> a bien été enregistré.
    </p>
    <p style="margin:0 0 12px 0;font-size:16px;line-height:1.6;color:#374151;">
      Vous trouverez en pièce jointe le reçu Stripe de cette opération.
    </p>
    ${receiptUrl ? `<p style="margin:0;font-size:14px;line-height:1.6;color:#6b7280;">Consultation du reçu : <a href="${receiptUrl}" style="color:#2b8a3e;text-decoration:none;">ouvrir le reçu Stripe</a></p>` : ''}
  `;
}

export function buildPurchaseConfirmationMailTemplate(data: PurchaseConfirmationMailData, options: ClubMailTemplateOptions = {}): string {
  return buildClubMailTemplate(buildPurchaseConfirmationBodyHtml(data), options);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}