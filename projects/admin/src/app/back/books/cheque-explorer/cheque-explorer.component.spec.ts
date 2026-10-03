import { BookEntry, FINANCIAL_ACCOUNT, TRANSACTION_ID } from '../../../common/interfaces/accounting.interface';
import { buildChequeDeposits } from './cheque-explorer.component';

describe('buildChequeDeposits', () => {
  const banks = [{ key: 'BNP', name: 'BNP Paribas' }];

  function cheque(id: string, amount: number, depositRef: string): BookEntry {
    return {
      id,
      season: '2026/2027',
      date: '2026-10-01',
      transaction_id: TRANSACTION_ID.achat_adhérent_par_chèque,
      cheque_ref: `BNP${id}`,
      deposit_ref: depositRef,
      amounts: { [FINANCIAL_ACCOUNT.CASHBOX_debit]: amount },
      operations: [{ label: 'adhésion', member: 'TEST Jean', values: { ADH: amount } }],
    };
  }

  function deposit(reference: string, amount: number): BookEntry {
    return {
      id: `deposit-${reference}`,
      season: '2026/2027',
      date: '2026-10-03',
      transaction_id: TRANSACTION_ID.dépôt_caisse_chèques,
      deposit_ref: reference,
      bank_report: '26-10',
      amounts: {
        [FINANCIAL_ACCOUNT.CASHBOX_credit]: amount,
        [FINANCIAL_ACCOUNT.BANK_debit]: amount,
      },
      operations: [],
    };
  }

  it('groups cheque references under their balanced deposit', () => {
    const entries = [cheque('001', 30, 'REM-42'), cheque('002', 20, 'REM-42'), deposit('REM-42', 50)];

    const result = buildChequeDeposits(entries, banks, entry =>
      entry.transaction_id === TRANSACTION_ID.achat_adhérent_par_chèque
    );

    expect(result.length).toBe(1);
    expect(result[0].status).toBe('deposited');
    expect(result[0].amount).toBe(50);
    expect(result[0].cheques.map(item => item.number)).toEqual(['001', '002']);
    expect(result[0].cheques[0].bank).toBe('BNP Paribas');
  });

  it('reports a difference between the deposit and its associated cheques', () => {
    const entries = [cheque('003', 40, 'REM-43'), deposit('REM-43', 45)];

    const result = buildChequeDeposits(entries, banks, entry =>
      entry.transaction_id === TRANSACTION_ID.achat_adhérent_par_chèque
    );

    expect(result[0].status).toBe('anomaly');
    expect(result[0].difference).toBe(5);
  });

  it('keeps temporary and unassigned cheques visible', () => {
    const entries = [cheque('004', 10, 'TEMP_2026-10-03'), cheque('005', 15, '')];

    const result = buildChequeDeposits(entries, banks, () => true);

    expect(result.map(item => item.status)).toEqual(['pending_reference', 'in_cashbox']);
    expect(result.some(item => item.displayReference === 'Non déposés')).toBeTrue();
  });

  it('lists a direct cheque deposit without a deposit reference', () => {
    const directDeposit = {
      id: 'direct-99',
      season: '2026/2027',
      date: '2026-09-23',
      transaction_id: TRANSACTION_ID.dépôt_collecte_chèques,
      bank_report: '26-09',
      amounts: { [FINANCIAL_ACCOUNT.BANK_debit]: 99 },
      operations: [{ label: 'don hommage', values: { DON: 99 } }],
    } as BookEntry;

    const result = buildChequeDeposits([directDeposit], banks, () => false);

    expect(result.length).toBe(1);
    expect(result[0].displayReference).toBe('—');
    expect(result[0].date).toBe('2026-09-23');
    expect(result[0].bankReport).toBe('26-09');
    expect(result[0].amount).toBe(99);
    expect(result[0].depositedAmount).toBe(99);
    expect(result[0].difference).toBe(0);
    expect(result[0].status).toBe('deposited');
    expect(result[0].chequeCount).toBeNull();
    expect(result[0].depositEntry).toBe(directDeposit);
  });
});