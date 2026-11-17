import { BookEntry, FINANCIAL_ACCOUNT, TRANSACTION_ID } from '../../../common/interfaces/accounting.interface';
import { DBhandler } from '../../../common/services/graphQL.service';
import { BookService } from '../../services/book.service';
import { StripeReconciliationHealthService } from './stripe-reconciliation-health.service';

describe('StripeReconciliationHealthService', () => {
  const payment: BookEntry = {
    id: 'online-payment',
    season: '2026/2027',
    date: '2026-11-11',
    stripeTag: 'stripe:online-payment',
    transaction_id: TRANSACTION_ID.achat_adhérent_par_carte,
    amounts: { [FINANCIAL_ACCOUNT.STRIPE_debit]: 40 },
    operations: [{ member: 'TEST Jean', label: 'vendu par en ligne', values: { INI: 40 } }],
  };
  const abandoned: BookEntry = {
    ...payment,
    id: 'abandoned-checkout',
    stripeTag: 'stripe:abandoned',
  };

  function setup() {
    const bookService = jasmine.createSpyObj<BookService>('BookService', ['get_book_entries']);
    const dbHandler = jasmine.createSpyObj<DBhandler>('DBhandler', [
      'listUnpayoutedStripeTransactions', 'listAbandonedStripeTransactions',
    ]);
    bookService.get_book_entries.and.returnValue([payment, abandoned]);
    dbHandler.listUnpayoutedStripeTransactions.and.resolveTo([]);
    dbHandler.listAbandonedStripeTransactions.and.resolveTo([]);
    const service = new StripeReconciliationHealthService(bookService, dbHandler);
    return { service, bookService, dbHandler };
  }

  it('uses the latest book entries when a payout completes during a shared refresh', async () => {
    const { service, bookService, dbHandler } = setup();
    let resolveTransactions!: (transactions: []) => void;
    dbHandler.listUnpayoutedStripeTransactions.and.returnValue(new Promise(resolve => {
      resolveTransactions = resolve;
    }));

    const refresh = service.refresh();
    expect(service.refresh()).toBe(refresh);
    bookService.get_book_entries.and.returnValue([
      { ...payment, deposit_ref: 'po_paid' },
      abandoned,
    ]);
    resolveTransactions([]);

    const snapshot = await refresh;
    expect(snapshot.candidateBookEntries).toEqual([abandoned]);
    expect(snapshot.abandonedCheckouts).toEqual([abandoned]);
    expect(snapshot.staleAbandonedCheckouts).toEqual([abandoned]);
  });

  it('keeps genuine abandoned checkouts without flagging a confirmed payment', async () => {
    const { service, dbHandler } = setup();
    dbHandler.listUnpayoutedStripeTransactions.and.resolveTo([{
      id: 'transaction',
      status: 'completed',
      bookEntryId: payment.id,
      stripeTag: payment.stripeTag,
    }]);

    const snapshot = await service.refresh();

    expect(snapshot.candidateBookEntries).toEqual([payment, abandoned]);
    expect(snapshot.abandonedCheckouts).toEqual([abandoned]);
  });
});
