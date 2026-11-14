import type { CardRequest, NfcCard } from './nfc-domain';

export const REQUEST_LABELS: Record<CardRequest['stage'], string> = {
  REQUESTED: 'À commander', ORDERED: 'Commandée', RECEIVED: 'À remettre',
  DELIVERED: 'Remise', CANCELLED: 'Annulée',
};

export function cardLabel(card: NfcCard): string {
  const state = card.stockState === 'AVAILABLE' ? 'Disponible'
    : card.stockState === 'LOST' ? 'Perdue'
    : card.stockState === 'RETIRED' ? 'Hors service'
    : card.status === 'ACTIVE' ? 'Active' : 'Désactivée';
  return `${card.kind === 'WHITE' ? 'Blanche' : card.kind === 'PERSONAL' ? 'Définitive' : 'Type à préciser'} — ${state}`;
}
