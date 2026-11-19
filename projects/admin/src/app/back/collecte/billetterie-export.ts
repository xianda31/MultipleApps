export interface ExportableReservation {
  memberName: string;
  isMember: boolean;
  paidAmount?: number | null;
  paymentId?: string | null;
  paymentMode?: string | null;
}

export const BILLETTERIE_CSV_HEADERS = ['nom', 'adhérent', 'montant réglé', 'type de paiement', 'réglé avec'];

export function paymentModeLabel(mode: string | null | undefined): string {
  if (mode === 'cash') return 'espèces';
  if (mode === 'cheque') return 'chèque';
  if (mode === 'card') return 'CB';
  return 'autre';
}

/** Lignes de l'export billetterie, triées par nom ; « réglé avec » liste les autres personnes du même paiement. */
export function billetterieCsvRows(reservations: ExportableReservation[]): string[][] {
  const sorted = [...reservations].sort((a, b) => a.memberName.localeCompare(b.memberName, 'fr', { sensitivity: 'base' }));
  return sorted.map((row) => [
    row.memberName,
    row.isMember ? 'oui' : 'non',
    (row.paidAmount ?? 0).toFixed(2),
    paymentModeLabel(row.paymentMode),
    row.paymentId
      ? sorted.filter((other) => other !== row && other.paymentId === row.paymentId).map((other) => other.memberName).join(', ')
      : '',
  ]);
}
