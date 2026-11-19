import { BILLETTERIE_CSV_HEADERS, billetterieCsvRows } from './billetterie-export';

describe('billetterie CSV export', () => {
  it('keeps the real payment mode of a grouped payment and names the other payers', () => {
    const rows = billetterieCsvRows([
      { memberName: 'RENOUX Christian', isMember: true, paidAmount: 15, paymentId: 'p1', paymentMode: 'cheque' },
      { memberName: 'ABÉLANET Jean', isMember: true, paidAmount: 15, paymentId: 'p1', paymentMode: 'cheque' },
      { memberName: 'MARTIN Paul', isMember: false, paidAmount: 20, paymentId: 'p2', paymentMode: 'cash' },
    ]);

    expect(BILLETTERIE_CSV_HEADERS).toContain('réglé avec');
    expect(rows).toEqual([
      ['ABÉLANET Jean', 'oui', '15.00', 'chèque', 'RENOUX Christian'],
      ['MARTIN Paul', 'non', '20.00', 'espèces', ''],
      ['RENOUX Christian', 'oui', '15.00', 'chèque', 'ABÉLANET Jean'],
    ]);
  });

  it('lists every other payer of a payment covering three people', () => {
    const rows = billetterieCsvRows(['C', 'A', 'B'].map((name) => (
      { memberName: name, isMember: true, paidAmount: 10, paymentId: 'p1', paymentMode: 'card' }
    )));

    expect(rows.map((row) => [row[0], row[3], row[4]])).toEqual([
      ['A', 'CB', 'B, C'],
      ['B', 'CB', 'A, C'],
      ['C', 'CB', 'A, B'],
    ]);
  });
});
