import { BookEntry, FINANCIAL_ACCOUNT, TRANSACTION_ID } from '../../common/interfaces/accounting.interface';
import { TransactionService } from './transaction.service';

describe('TransactionService contextual labels', () => {
  const service = new TransactionService(jasmine.createSpyObj('ToastService', ['showError']));

  function transfer(amounts: BookEntry['amounts']): BookEntry {
    return {
      id: 'transfer',
      season: '2026/2027',
      date: '2026-10-04',
      transaction_id: TRANSACTION_ID.achat_adhérent_par_virement,
      amounts,
      operations: [],
    };
  }

  it('uses lowercase for a technical announced transfer', () => {
    expect(service.get_entry_label(transfer({}))).toBe('virement annoncé');
  });

  it('uses uppercase for a received transfer that is bank-reconcilable', () => {
    expect(service.get_entry_label(transfer({ [FINANCIAL_ACCOUNT.BANK_debit]: 50 }))).toBe('VIREMENT');
  });
});