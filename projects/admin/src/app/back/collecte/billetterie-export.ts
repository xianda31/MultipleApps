export interface ExportableReservation {
  memberName: string;
  isMember: boolean;
  paidAmount?: number | null;
  paymentId?: string | null;
  paymentMode?: string | null;
  paidChannel?: string | null;
  bookEntryId?: string | null;
}

export const BILLETTERIE_CSV_HEADERS = ['nom', 'adhérent', 'montant réglé', 'type de paiement', 'payé via', 'réglé avec'];

export function paymentModeLabel(mode: string | null | undefined): string {
  if (mode === 'cash') return 'espèces';
  if (mode === 'cheque') return 'chèque';
  if (mode === 'card') return 'CB';
  return 'autre';
}

/** Où le paiement a été encaissé ; une réservation payée sans canal date d'avant la vente en caisse ou en ligne. */
export function paidChannelLabel(channel: string | null | undefined): string {
  if (channel === 'en_ligne') return 'en ligne';
  if (channel === 'caisse') return 'caisse';
  return 'billetterie';
}

/** Lignes de l'export billetterie, triées par nom ; « réglé avec » liste les autres personnes du même paiement. */
export function billetterieCsvRows(reservations: ExportableReservation[]): string[][] {
  const sorted = [...reservations].sort((a, b) => a.memberName.localeCompare(b.memberName, 'fr', { sensitivity: 'base' }));
  const paymentOf = (row: ExportableReservation) => row.paymentId || row.bookEntryId || '';
  return sorted.map((row) => [
    row.memberName,
    row.isMember ? 'oui' : 'non',
    (row.paidAmount ?? 0).toFixed(2),
    paymentModeLabel(row.paymentMode),
    paidChannelLabel(row.paidChannel),
    paymentOf(row)
      ? sorted.filter((other) => other !== row && paymentOf(other) === paymentOf(row)).map((other) => other.memberName).join(', ')
      : '',
  ]);
}
