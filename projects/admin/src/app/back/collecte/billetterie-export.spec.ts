import { BILLETTERIE_CSV_HEADERS, billetterieCsvRows } from './billetterie-export';

describe('billetterie CSV export', () => {
  it('keeps the real payment mode of a grouped payment and names the other payers', () => {
    const rows = billetterieCsvRows([
      { memberName: 'RENOUX Christian', isMember: true, paidAmount: 15, paymentId: 'p1', paymentMode: 'cheque', paidChannel: 'billetterie' },
      { memberName: 'ABÉLANET Jean', isMember: true, paidAmount: 15, paymentId: 'p1', paymentMode: 'cheque', paidChannel: 'billetterie' },
      { memberName: 'MARTIN Paul', isMember: false, paidAmount: 20, paymentId: 'p2', paymentMode: 'cash' },
    ]);

    expect(BILLETTERIE_CSV_HEADERS).toEqual(['nom', 'adhérent', 'montant réglé', 'type de paiement', 'payé via', 'réglé avec']);
    expect(rows).toEqual([
      ['ABÉLANET Jean', 'oui', '15.00', 'chèque', 'billetterie', 'RENOUX Christian'],
      ['MARTIN Paul', 'non', '20.00', 'espèces', 'billetterie', ''],
      ['RENOUX Christian', 'oui', '15.00', 'chèque', 'billetterie', 'ABÉLANET Jean'],
    ]);
  });

  it('lists every other payer of a payment covering three people', () => {
    const rows = billetterieCsvRows(['C', 'A', 'B'].map((name) => (
      { memberName: name, isMember: true, paidAmount: 10, paymentId: 'p1', paymentMode: 'card' }
    )));

    expect(rows.map((row) => [row[0], row[3], row[5]])).toEqual([
      ['A', 'CB', 'B, C'],
      ['B', 'CB', 'A, C'],
      ['C', 'CB', 'A, B'],
    ]);
  });

  it('shows online and counter payments, grouped by their sale', () => {
    const rows = billetterieCsvRows([
      { memberName: 'DUPONT Anne', isMember: true, paidAmount: 15, paymentMode: 'card', paidChannel: 'en_ligne', bookEntryId: 'sale-1' },
      { memberName: 'DUPONT Jean', isMember: true, paidAmount: 15, paymentMode: 'card', paidChannel: 'en_ligne', bookEntryId: 'sale-1' },
      { memberName: 'MARTIN Paul', isMember: true, paidAmount: 15, paymentMode: 'cash', paidChannel: 'caisse', bookEntryId: 'sale-2' },
    ]);

    expect(rows.map((row) => [row[0], row[3], row[4], row[5]])).toEqual([
      ['DUPONT Anne', 'CB', 'en ligne', 'DUPONT Jean'],
      ['DUPONT Jean', 'CB', 'en ligne', 'DUPONT Anne'],
      ['MARTIN Paul', 'espèces', 'caisse', ''],
    ]);
  });
});
