import { firstValueFrom, of } from 'rxjs';

import { BALANCE_ACCOUNT, BookEntry, CUSTOMER_ACCOUNT, FINANCIAL_ACCOUNT, TRANSACTION_ID, TRANSFER_PROMISE_REF_PREFIX } from '../../common/interfaces/accounting.interface';
import { BookService } from './book.service';

describe('BookService', () => {
  function createService(transactionOverrides: Record<string, unknown> = {}, dbHandler: Record<string, unknown> = {}) {
    return new BookService(
      {
        get_configuration: () => of({ season: '2026/2027' }),
        start_date: (season: string) => `${season.slice(0, 4)}-07-01`,
        assert_accounting_write_allowed: () => undefined,
        assert_season_initialization_allowed: () => undefined,
      } as any,
      { showInfo: () => undefined } as any,
      { get_transaction: () => ({ revenue_account_to_show: true, ...transactionOverrides }) } as any,
      dbHandler as any,
      { logged_member$: of(null) } as any,
    );
  }

  it('prorates operation values for a partial Stripe refund', async () => {
    const service = createService();
    const sourceEntry: BookEntry = {
      id: 'source-entry',
      season: '2026/2027',
      date: '2026-09-17',
      transaction_id: TRANSACTION_ID.achat_adhérent_par_carte,
      stripeTag: 'stripe:test',
      amounts: { [FINANCIAL_ACCOUNT.STRIPE_debit]: 100 },
      operations: [
        { label: 'adhésion', values: { ADH: 60 } },
        { label: 'carte', values: { CAR: 40 } },
      ],
    };
    const createSpy = spyOn(service, 'create_book_entry').and.callFake(async entry => entry);

    await service.create_refund_book_entry(sourceEntry, 2738);

    const refundEntry = createSpy.calls.mostRecent().args[0];
    expect(refundEntry.amounts[FINANCIAL_ACCOUNT.STRIPE_credit]).toBe(27.38);
    expect(refundEntry.operations.map(operation => operation.values)).toEqual([
      { ADH: -16.43 },
      { CAR: -10.95 },
    ]);
  });

  it('identifies an existing unbalanced partial refund', () => {
    const service = createService();
    const unbalancedRefund: BookEntry = {
      id: 'bad-refund',
      season: '2026/2027',
      date: '2026-09-17',
      transaction_id: TRANSACTION_ID.annulation_paiement_carte_adhérent,
      stripeTag: 'stripe:test',
      amounts: { [FINANCIAL_ACCOUNT.STRIPE_credit]: 27.38 },
      operations: [{ label: 'remboursement', values: { ADH: -54.76 } }],
    };
    (service as any)._book_entries = [unbalancedRefund];

    expect(service.get_unbalanced_book_entries()).toEqual([
      { entry: unbalancedRefund, error: 27.38 },
    ]);
  });

  it('accepts balanced opening entries in current-entry diagnostics', () => {
    const service = createService();
    const openingEntry: BookEntry = {
      id: 'opening-entry',
      season: '2026/2027',
      date: '2026-07-01',
      transaction_id: TRANSACTION_ID.report_psp,
      amounts: { report_in: 50, stripe_in: 50 },
      operations: [{ label: 'report PSP', values: {} }],
    };
    (service as any)._book_entries = [openingEntry];

    expect(service.get_unbalanced_book_entries()).toEqual([]);
  });

  it('keeps an announced-transfer settlement in the bank balance after unpointing', () => {
    const service = createService();
    const promise: BookEntry = {
      id: 'promise-1',
      season: '2026/2027',
      date: '2026-10-02',
      transaction_id: TRANSACTION_ID.achat_adhérent_par_virement,
      amounts: {},
      operations: [{
        label: 'vente',
        member: 'TEST Jean',
        values: { ADH: 50, [CUSTOMER_ACCOUNT.DEBT_debit]: 50 },
      }],
    };
    const unpointedSettlement: BookEntry = {
      id: 'settlement-1',
      season: '2026/2027',
      date: '2026-10-03',
      transaction_id: TRANSACTION_ID.achat_adhérent_par_virement,
      amounts: { [FINANCIAL_ACCOUNT.BANK_debit]: 50 },
      operations: [{
        label: 'règlement du virement annoncé',
        member: 'TEST Jean',
        values: { [CUSTOMER_ACCOUNT.DEBT_credit]: 50 },
      }],
      bank_report: null,
      deposit_ref: `${TRANSFER_PROMISE_REF_PREFIX}${promise.id}`,
    };
    (service as any)._book_entries = [promise, unpointedSettlement];

    expect(service.get_bank_movements_amount()).toBe(50);
    expect(service.get_clients_debts_value()).toBe(0);
    expect(service.get_unpointed_transfer_settlements()).toEqual([unpointedSettlement]);
  });

  it('returns no unpointed transfer while entries are still loading', () => {
    const service = createService();

    expect(service.get_unpointed_transfer_settlements()).toEqual([]);
  });

  it('creates only missing entries when closure generation is resumed', async () => {
    const createBookEntry = jasmine.createSpy('createBookEntry').and.callFake(async (entry: BookEntry) => entry);
    const listBookEntries = jasmine.createSpy('listBookEntries').and.returnValue(of([{
      id: 'existing-opening',
      season: '2027/2028',
      date: '2027-07-01',
      tag: 'closure:2026/2027:2027/2028:0',
    }]));
    const service = createService({}, { createBookEntry, listBookEntries });
    (service as any)._book_entries = [
      {
        id: 'stripe-1',
        season: '2026/2027',
        date: '2027-06-29',
        transaction_id: TRANSACTION_ID.achat_adhérent_par_carte,
        amounts: { [FINANCIAL_ACCOUNT.STRIPE_debit]: 30 },
        operations: [{ label: 'paiement 1', values: { VENTES: 30 } }],
      },
      {
        id: 'stripe-2',
        season: '2026/2027',
        date: '2027-06-30',
        transaction_id: TRANSACTION_ID.achat_adhérent_par_carte,
        amounts: { [FINANCIAL_ACCOUNT.STRIPE_debit]: 20 },
        operations: [{ label: 'paiement 2', values: { VENTES: 20 } }],
      },
    ];

    expect(await firstValueFrom(service.generate_next_season_entries('2027/2028'))).toBe(1);
    expect(createBookEntry).toHaveBeenCalledTimes(1);
    expect(createBookEntry.calls.mostRecent().args[0].tag).toBe('closure:2026/2027:2027/2028:1');
  });

  it('identifies an unbalanced opening entry', () => {
    const service = createService();
    const openingEntry: BookEntry = {
      id: 'bad-opening-entry',
      season: '2026/2027',
      date: '2026-07-01',
      transaction_id: TRANSACTION_ID.report_psp,
      amounts: {
        [BALANCE_ACCOUNT.BAL_debit]: 50,
        [FINANCIAL_ACCOUNT.STRIPE_debit]: 40,
      },
      operations: [{ label: 'report PSP', values: {} }],
    };
    (service as any)._book_entries = [openingEntry];

    expect(service.get_unbalanced_book_entries()).toEqual([
      { entry: openingEntry, error: 10 },
    ]);
  });

  it('rejects an unbalanced entry before creating it', async () => {
    const createBookEntry = jasmine.createSpy('createBookEntry');
    const service = createService({}, { createBookEntry });
    const entry: BookEntry = {
      id: '',
      season: '2026/2027',
      date: '2026-09-18',
      transaction_id: TRANSACTION_ID.vente_en_espèces,
      amounts: { [FINANCIAL_ACCOUNT.CASHBOX_debit]: 100 },
      operations: [{ label: 'vente', values: { VENTES: 90 } }],
    };

    await expectAsync(service.create_book_entry(entry)).toBeRejectedWithError(/déséquilibrée de 10\.00/);
    expect(createBookEntry).not.toHaveBeenCalled();
  });

  it('rejects a new entry when its accounting season is locked', async () => {
    const createBookEntry = jasmine.createSpy('createBookEntry');
    const service = createService({}, { createBookEntry });
    const seasonGuard = spyOn((service as any).systemDataService, 'assert_accounting_write_allowed')
      .and.throwError('Saison non initialisée');
    const entry: BookEntry = {
      id: '',
      season: '2027/2028',
      date: '2027-07-01',
      transaction_id: TRANSACTION_ID.vente_en_espèces,
      amounts: { [FINANCIAL_ACCOUNT.CASHBOX_debit]: 100 },
      operations: [{ label: 'vente', values: { VENTES: 100 } }],
    };

    await expectAsync(service.create_book_entry(entry)).toBeRejectedWithError(/Saison non initialisée/);
    expect(seasonGuard).toHaveBeenCalledOnceWith(entry.season);
    expect(createBookEntry).not.toHaveBeenCalled();
  });

  it('rejects an unbalanced entry before updating it', async () => {
    const updateBookEntry = jasmine.createSpy('updateBookEntry');
    const service = createService({}, { updateBookEntry });
    const entry: BookEntry = {
      id: 'bad-update',
      season: '2026/2027',
      date: '2026-09-18',
      transaction_id: TRANSACTION_ID.vente_en_espèces,
      amounts: { [FINANCIAL_ACCOUNT.CASHBOX_debit]: 100 },
      operations: [{ label: 'vente', values: { VENTES: 90 } }],
    };

    await expectAsync(service.update_book_entry(entry)).toBeRejectedWithError(/déséquilibrée de 10\.00/);
    expect(updateBookEntry).not.toHaveBeenCalled();
  });

  it('rejects an entire bulk before creating any entry', async () => {
    const createBookEntry = jasmine.createSpy('createBookEntry');
    const service = createService({}, { createBookEntry });
    const entries: BookEntry[] = [{
      id: '',
      season: '2026/2027',
      date: '2026-09-18',
      transaction_id: TRANSACTION_ID.vente_en_espèces,
      amounts: { [FINANCIAL_ACCOUNT.CASHBOX_debit]: 100 },
      operations: [{ label: 'vente', values: { VENTES: 90 } }],
    }];

    expect(await firstValueFrom(service.book_entries_bulk_create$(entries))).toBe(0);
    expect(createBookEntry).not.toHaveBeenCalled();
  });

  it('allows an opening entry through the central create boundary', async () => {
    const openingEntry: BookEntry = {
      id: '',
      season: '2026/2027',
      date: '2026-07-01',
      transaction_id: TRANSACTION_ID.report_psp,
      amounts: {
        [FINANCIAL_ACCOUNT.STRIPE_debit]: 50,
        [BALANCE_ACCOUNT.BAL_debit]: 50,
      },
      operations: [{ label: 'report PSP', values: {} }],
    };
    const createBookEntry = jasmine.createSpy('createBookEntry').and.resolveTo(openingEntry);
    const service = createService({}, { createBookEntry });
    (service as any)._book_entries = [];

    await expectAsync(service.create_book_entry(openingEntry)).toBeResolvedTo(openingEntry);
    expect(createBookEntry).toHaveBeenCalledOnceWith(openingEntry);
  });

  it('rejects non-finite amounts before persistence', async () => {
    const createBookEntry = jasmine.createSpy('createBookEntry');
    const service = createService({}, { createBookEntry });
    const entry: BookEntry = {
      id: '',
      season: '2026/2027',
      date: '2026-09-18',
      transaction_id: TRANSACTION_ID.vente_en_espèces,
      amounts: { [FINANCIAL_ACCOUNT.CASHBOX_debit]: Number.NaN },
      operations: [{ label: 'vente', values: { VENTES: Number.NaN } }],
    };

    await expectAsync(service.create_book_entry(entry)).toBeRejectedWithError(/montant invalide/);
    expect(createBookEntry).not.toHaveBeenCalled();
  });
});