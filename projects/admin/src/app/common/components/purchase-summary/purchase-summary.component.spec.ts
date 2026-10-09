import { CUSTOMER_ACCOUNT, PurchaseStatementEntry, TRANSACTION_ID } from '../../interfaces/accounting.interface';
import { PurchaseSummaryComponent } from './purchase-summary.component';

describe('PurchaseSummaryComponent', () => {
  function debtCreditEntry(transactionId: TRANSACTION_ID, amount: number): PurchaseStatementEntry {
    return {
      id: transactionId,
      date: '2026-10-09',
      transactionId,
      transaction: 'test',
      amount: 0,
      spentAmount: 0,
      items: [{
        key: CUSTOMER_ACCOUNT.DEBT_credit,
        code: 'CRÉANCE',
        description: 'créance remboursée',
        amount,
      }],
    };
  }

  it('separates debt cancellation from actual debt repayment', () => {
    const component = new PurchaseSummaryComponent();
    component.entries = [
      debtCreditEntry(TRANSACTION_ID.achat_adhérent_par_virement, 20),
      debtCreditEntry(TRANSACTION_ID.annulation_dette_adhérent, 30),
    ];

    expect(component.totalDebtRepaid).toBe(20);
    expect(component.totalDebtCancelled).toBe(30);
  });
});
