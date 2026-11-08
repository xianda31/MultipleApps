import { BehaviorSubject, firstValueFrom, of, Subject } from 'rxjs';

import { BALANCE_ACCOUNT, BookEntry, CUSTOMER_ACCOUNT, FINANCIAL_ACCOUNT, TRANSACTION_ID, TRANSFER_PROMISE_REF_PREFIX } from '../../common/interfaces/accounting.interface';
import { TRANSACTION_CLASS } from '../../common/interfaces/transaction.definition';
import { BookService } from './book.service';
import { Group_names } from '../../common/authentification/group.interface';
import { GroupService } from '../../common/authentification/group.service';

describe('BookService', () => {
  function createService(
    transactionOverrides: Record<string, unknown> = {},
    dbHandler: Record<string, unknown> = {},
    groups: Group_names[] = [Group_names.Admin],
  ) {
    const groupService = jasmine.createSpyObj<GroupService>('GroupService', ['getCurrentUserGroups']);
    groupService.getCurrentUserGroups.and.resolveTo(groups);
    return new BookService(
      {
        get_configuration: () => of({ season: '2026/2027' }),
        start_date: (season: string) => `${season.slice(0, 4)}-07-01`,
        assert_accounting_write_allowed: (season: string) => {
          if (season !== '2026/2027') throw new Error('Saison verrouillée');
        },
        assert_season_initialization_allowed: () => undefined,
        can_write_accounting_season: (season: string) => season === '2026/2027',
        get_accounting_season_state: () => ({
          initializedSeason: '2026/2027', calendarSeason: '2026/2027', status: 'open', writesAllowed: true,
        }),
      } as any,
      { showInfo: () => undefined, showError: () => undefined } as any,
      {
        get_transaction: () => ({ revenue_account_to_show: true, ...transactionOverrides }),
        get_entry_label: () => 'virement annoncé',
        transaction_class: () => transactionOverrides['class'],
      } as any,
      dbHandler as any,
      { logged_member$: of(null) } as any,
      groupService,
    );
  }

  describe('past-season documentation', () => {
    const original: BookEntry = {
      id: 'historical-entry', season: '2025/2026', date: '2026-05-10',
      transaction_id: TRANSACTION_ID.achat_adhérent_par_carte,
      tag: 'ancien', invoice_ref: 'old.pdf', stripeTag: 'stripe:original',
      stripeSessionId: 'cs_original', status: 'confirmed',
      purchasedItems: [{ productId: 'card', beneficiaryMemberIds: ['member'], quantity: 1 }],
      cheque_ref: 'BNK123', deposit_ref: 'deposit', bank_report: '2026-05',
      amounts: { stripe_in: 30 },
      operations: [{ label: 'ancien libellé', member: 'TEST Jean', productCodes: '#CAR12', values: { CAR: 30 } }],
    };

    for (const group of [Group_names.Admin, Group_names.System]) {
      it(`allows documentation-only changes for ${group} without running accounting audit`, async () => {
        const changed = {
          ...original, amounts: { stripe_in: 31 }, tag: 'corrigé', invoice_ref: undefined,
          operations: original.operations.map(operation => ({ ...operation, label: 'nouveau libellé' })),
        };
        const read = jasmine.createSpy('readBookEntry').and.resolveTo({
          ...structuredClone(original), amounts: { stripe_in: 31 },
        });
        const update = jasmine.createSpy('updateBookEntryDocumentation').and.resolveTo(changed);
        const service = createService({}, { readBookEntry: read, updateBookEntryDocumentation: update }, [group]);

        await expectAsync(service.update_book_entry_documentation(changed)).toBeResolvedTo(changed);
        expect(update).toHaveBeenCalledOnceWith(original.id, {
          tag: 'corrigé', invoice_ref: null, operations: changed.operations,
        });
        expect(service.get_book_entries()[0].amounts).toEqual({ stripe_in: 31 });
      });
    }

    for (const groups of [[], [Group_names.Member], [Group_names.Support], [Group_names.Editor]]) {
      it(`rejects documentary updates without an Admin/System group (${groups.join(',') || 'none'})`, async () => {
        const update = jasmine.createSpy('updateBookEntryDocumentation');
        const service = createService({}, {
          readBookEntry: jasmine.createSpy('readBookEntry').and.resolveTo(original),
          updateBookEntryDocumentation: update,
        }, groups);
        spyOn(console, 'error');
        await expectAsync(service.update_book_entry_documentation({ ...original, tag: 'changed' })).toBeRejected();
        expect(update).not.toHaveBeenCalled();
      });
    }

    const forbiddenChanges: Array<{ title: string; change: (entry: BookEntry) => void }> = [
      { title: 'amounts', change: entry => { entry.amounts.stripe_in = 60; } },
      { title: 'operation values', change: entry => { entry.operations[0].values['CAR'] = 60; } },
      { title: 'beneficiary', change: entry => { entry.operations[0].member = 'AUTRE Jean'; } },
      { title: 'product codes', change: entry => { entry.operations[0].productCodes = '#OTHER'; } },
      { title: 'date', change: entry => { entry.date = '2026-05-11'; } },
      { title: 'season', change: entry => { entry.season = '2026/2027'; } },
      { title: 'transaction', change: entry => { entry.transaction_id = TRANSACTION_ID.vente_en_espèces; } },
      { title: 'bank audit', change: entry => { entry.bank_report = null; } },
      { title: 'cheque reference', change: entry => { entry.cheque_ref = 'BNK999'; } },
      { title: 'deposit reference', change: entry => { entry.deposit_ref = 'other'; } },
      { title: 'Stripe reference', change: entry => { entry.stripeTag = 'stripe:other'; } },
      { title: 'Stripe session', change: entry => { entry.stripeSessionId = 'cs_other'; } },
      { title: 'status', change: entry => { entry.status = 'pending'; } },
      { title: 'purchased products', change: entry => { entry.purchasedItems = []; } },
      { title: 'operation count', change: entry => { entry.operations.push({ label: 'other', values: {} }); } },
      { title: 'missing accounting field', change: entry => { delete entry.deposit_ref; } },
    ];
    for (const { title, change } of forbiddenChanges) {
      it(`rejects changing ${title} even for System`, async () => {
        const changed = structuredClone(original);
        change(changed);
        const update = jasmine.createSpy('updateBookEntryDocumentation');
        const service = createService({}, {
          readBookEntry: jasmine.createSpy('readBookEntry').and.resolveTo(structuredClone(original)),
          updateBookEntryDocumentation: update,
        }, [Group_names.System]);
        spyOn(console, 'error');
        await expectAsync(service.update_book_entry_documentation(changed)).toBeRejected();
        expect(update).not.toHaveBeenCalled();
      });
    }

    it('sends only the changed reference and accepts reordered accounting object keys', async () => {
      const source: BookEntry = {
        ...original,
        operations: [{ ...original.operations[0], values: { CAR: 20, ADH: 10 } }],
      };
      const changed: BookEntry = {
        ...source, invoice_ref: 'new.pdf',
        operations: [{ ...source.operations[0], values: { ADH: 10, CAR: 20 } }],
      };
      const update = jasmine.createSpy('updateBookEntryDocumentation').and.resolveTo(changed);
      const service = createService({}, {
        readBookEntry: jasmine.createSpy('readBookEntry').and.resolveTo(source),
        updateBookEntryDocumentation: update,
      });
      await service.update_book_entry_documentation(changed);
      expect(update).toHaveBeenCalledOnceWith(original.id, { invoice_ref: 'new.pdf' });
    });

    it('rejects a stale accounting snapshot rather than overwriting newer amounts', async () => {
      const update = jasmine.createSpy('updateBookEntryDocumentation');
      const service = createService({}, {
        readBookEntry: jasmine.createSpy('readBookEntry').and.resolveTo({
          ...original, bank_report: '2026-06',
        }),
        updateBookEntryDocumentation: update,
      });
      spyOn(console, 'error');
      await expectAsync(service.update_book_entry_documentation({ ...original, tag: 'new' })).toBeRejected();
      expect(update).not.toHaveBeenCalled();
    });

    it('does not authorize documentary edits on a future, unopened season', async () => {
      const future = { ...original, season: '2027/2028' };
      const service = createService();
      await expectAsync(service.can_edit_book_entry_documentation(future)).toBeResolvedTo(false);
    });

    it('keeps general accounting updates and deletes blocked on a past season', async () => {
      const update = jasmine.createSpy('updateBookEntry');
      const remove = jasmine.createSpy('deleteBookEntry');
      const service = createService({}, { updateBookEntry: update, deleteBookEntry: remove });
      await expectAsync(service.update_book_entry(original)).toBeRejectedWithError('Saison verrouillée');
      await expectAsync(service.delete_book_entry(original)).toBeRejectedWithError('Saison verrouillée');
      expect(update).not.toHaveBeenCalled();
      expect(remove).not.toHaveBeenCalled();
    });
  });

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
      amounts: { [CUSTOMER_ACCOUNT.DEBT_debit]: 50 },
      operations: [{
        label: 'vente',
        member: 'TEST Jean',
        values: { ADH: 50 },
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

  it('builds a member purchase statement from source entries', () => {
    const service = createService({ class: TRANSACTION_CLASS.REVENUE_FROM_MEMBER });
    const purchase: BookEntry = {
      id: 'purchase-1',
      season: '2026/2027',
      date: '2026-10-03',
      transaction_id: TRANSACTION_ID.achat_adhérent_par_virement,
      amounts: {},
      operations: [
        {
          label: 'adhésion',
          member: 'TEST Jean',
          values: { ADH: 40, [CUSTOMER_ACCOUNT.DEBT_debit]: 40 },
        },
        {
          label: 'complément',
          member: 'TEST Jean',
          values: { ADH: 10, CAR: 30 },
        },
        {
          label: 'autre adhérent',
          member: 'AUTRE Marie',
          values: { ADH: 35 },
        },
      ],
    };
    (service as any)._book_entries = [purchase];

    expect(service.get_member_purchase_statement('TEST Jean', new Map([['ADH', 'Adhésion au club']]))).toEqual([{
      id: 'purchase-1',
      date: '2026-10-03',
      transactionId: TRANSACTION_ID.achat_adhérent_par_virement,
      transaction: 'virement annoncé',
      amount: 0,
      spentAmount: 115,
      items: [
        { key: 'ADH', code: 'ADH', description: 'Adhésion au club', amount: 50 },
        { key: CUSTOMER_ACCOUNT.DEBT_debit, code: 'CRÉANCE', description: 'achat à crédit', amount: -40 },
        { key: 'CAR', code: 'CAR', description: 'CAR', amount: 30 },
        { key: 'ADH', code: 'ADH', description: 'Adhésion au club', amount: 35, beneficiary: 'AUTRE Marie' },
      ],
    }]);
  });

  it('restricts an admin member statement to that member in a multi-member entry', () => {
    const service = createService({ class: TRANSACTION_CLASS.REVENUE_FROM_MEMBER });
    const purchase: BookEntry = {
      id: 'multi-member-purchase',
      season: '2026/2027',
      date: '2026-08-12',
      transaction_id: TRANSACTION_ID.achat_adhérent_en_espèces,
      amounts: { [FINANCIAL_ACCOUNT.CASHBOX_debit]: 70 },
      operations: [
        {
          label: 'achat à crédit',
          member: 'AYRAL André',
          values: { CAR: 30, [CUSTOMER_ACCOUNT.DEBT_debit]: 30 },
        },
        {
          label: 'adhésion',
          member: 'AUTRE Marie',
          values: { ADH: 40 },
        },
      ],
    };
    (service as any)._book_entries = [purchase];

    expect(service.get_member_purchase_statement(
      'AYRAL André',
      new Map(),
      { memberOperationsOnly: true },
    )).toEqual([{
      id: 'multi-member-purchase',
      date: '2026-08-12',
      transactionId: TRANSACTION_ID.achat_adhérent_en_espèces,
      transaction: 'virement annoncé',
      amount: 0,
      spentAmount: 30,
      items: [
        { key: 'CAR', code: 'CAR', description: 'CAR', amount: 30 },
        { key: CUSTOMER_ACCOUNT.DEBT_debit, code: 'CRÉANCE', description: 'achat à crédit', amount: -30 },
      ],
    }]);
  });

  it('includes a customer-account-only settlement without counting it as spending', () => {
    const service = createService({ class: TRANSACTION_CLASS.REVENUE_FROM_MEMBER });
    const settlement: BookEntry = {
      id: 'settlement-1',
      season: '2026/2027',
      date: '2026-09-23',
      transaction_id: TRANSACTION_ID.achat_adhérent_en_espèces,
      amounts: { [FINANCIAL_ACCOUNT.CASHBOX_debit]: 10 },
      operations: [{
        label: 'vendu par Christian',
        member: 'LAUVERGNAT Michèle',
        values: { [CUSTOMER_ACCOUNT.DEBT_credit]: 30, [CUSTOMER_ACCOUNT.ASSET_debit]: 20 },
      }],
    };
    (service as any)._book_entries = [settlement];

    expect(service.get_member_purchase_statement('LAUVERGNAT Michèle')).toEqual([{
      id: 'settlement-1',
      date: '2026-09-23',
      transactionId: TRANSACTION_ID.achat_adhérent_en_espèces,
      transaction: 'virement annoncé',
      amount: 10,
      spentAmount: 0,
      items: [
        { key: CUSTOMER_ACCOUNT.DEBT_credit, code: 'CRÉANCE', description: 'créance remboursée', amount: 30 },
        { key: CUSTOMER_ACCOUNT.ASSET_debit, code: 'AVOIR', description: 'avoir utilisé', amount: -20 },
      ],
    }]);
  });

  it('does not count an asset grant expense as member spending', () => {
    const service = createService({ class: TRANSACTION_CLASS.EXPENSE_FOR_MEMBER });
    const assetGrant: BookEntry = {
      id: 'asset-grant-1',
      season: '2026/2027',
      date: '2026-10-09',
      transaction_id: TRANSACTION_ID.attribution_avoir,
      amounts: {},
      operations: [{
        label: 'avoir attribué',
        member: 'RENOUX Test',
        values: { BNV: 30, [CUSTOMER_ACCOUNT.ASSET_credit]: 30 },
      }],
    };
    (service as any)._book_entries = [assetGrant];

    const [statement] = service.get_member_purchase_statement('RENOUX Test');

    expect(statement.spentAmount).toBe(0);
    expect(statement.items).toEqual([
      { key: 'BNV', code: 'BNV', description: 'BNV', amount: 30 },
      { key: CUSTOMER_ACCOUNT.ASSET_credit, code: 'AVOIR', description: 'avoir attribué', amount: 30 },
    ]);
  });

  it('sorts same-day entries by creation time', () => {
    const service = createService({ class: TRANSACTION_CLASS.REVENUE_FROM_MEMBER });
    const purchase: BookEntry = {
      id: 'purchase',
      season: '2026/2027',
      date: '2026-08-02',
      createdAt: '2026-08-02T09:48:59.269Z',
      transaction_id: TRANSACTION_ID.achat_adhérent_par_carte,
      amounts: { [FINANCIAL_ACCOUNT.STRIPE_debit]: 30 },
      operations: [{ label: 'achat', member: 'TEST Jean', values: { CAR: 30 } }],
    };
    const cancellation: BookEntry = {
      id: 'cancellation',
      season: '2026/2027',
      date: '2026-08-02',
      createdAt: '2026-08-02T14:47:30.848Z',
      transaction_id: TRANSACTION_ID.annulation_paiement_carte_adhérent,
      amounts: { [FINANCIAL_ACCOUNT.STRIPE_credit]: 30 },
      operations: [{ label: 'annulation', member: 'TEST Jean', values: { CAR: -30 } }],
    };
    (service as any)._book_entries = [cancellation, purchase];

    expect(service.get_member_purchase_statement('TEST Jean').map(entry => entry.id))
      .toEqual(['purchase', 'cancellation']);
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

describe('BookService live synchronization', () => {
  const season = '2026/2027';

  function entry(id: string, amount: number = 10): BookEntry {
    return {
      id,
      season,
      date: '2026-10-08',
      transaction_id: TRANSACTION_ID.vente_en_espèces,
      amounts: { [FINANCIAL_ACCOUNT.CASHBOX_debit]: amount },
      operations: [{ label: 'vente', values: { VENTES: amount } }],
    };
  }

  function createLiveService(
    queryBookEntries: (season: string) => Subject<BookEntry[]>,
    dbOverrides: Record<string, unknown> = {},
    configuration$ = new BehaviorSubject({ season }),
  ) {
    const toastService = jasmine.createSpyObj('ToastService', [
      'showInfo',
      'showWarning',
      'showError',
    ]);
    const dbHandler = {
      queryBookEntries: jasmine.createSpy('queryBookEntries').and.callFake(queryBookEntries),
      ...dbOverrides,
    };
    const service = new BookService(
      {
        get_configuration: () => configuration$.asObservable(),
        assert_accounting_write_allowed: () => undefined,
        assert_season_initialization_allowed: () => undefined,
      } as any,
      toastService,
      {
        get_transaction: () => ({ revenue_account_to_show: true }),
      } as any,
      dbHandler as any,
      { logged_member$: of({ id: 'admin-1' }) } as any,
      jasmine.createSpyObj<GroupService>('GroupService', ['getCurrentUserGroups']),
    );
    return { service, dbHandler, toastService, configuration$ };
  }

  it('reflects remote create, update and delete snapshots on a second client', () => {
    const snapshots$ = new Subject<BookEntry[]>();
    const { service } = createLiveService(() => snapshots$);
    const first = entry('entry-1');
    const second = entry('entry-2');

    snapshots$.next([first]);
    expect(service.is_book_entries_loaded()).toBeTrue();

    snapshots$.next([first, second]);
    expect(service.get_book_entries().map(item => item.id)).toEqual(['entry-1', 'entry-2']);

    const updatedSecond = { ...second, amounts: { [FINANCIAL_ACCOUNT.CASHBOX_debit]: 20 } };
    snapshots$.next([first, updatedSecond]);
    expect(service.get_book_entries().find(item => item.id === second.id)?.amounts)
      .toEqual({ [FINANCIAL_ACCOUNT.CASHBOX_debit]: 20 });

    snapshots$.next([updatedSecond]);
    expect(service.get_book_entries().map(item => item.id)).toEqual(['entry-2']);
  });

  it('does not duplicate an entry when the local mutation resolves before the live snapshot', async () => {
    const snapshots$ = new Subject<BookEntry[]>();
    const first = entry('entry-1');
    const created = entry('entry-2');
    const { service } = createLiveService(() => snapshots$, {
      createBookEntry: jasmine.createSpy('createBookEntry').and.resolveTo(created),
    });
    snapshots$.next([first]);

    await service.create_book_entry(created);
    snapshots$.next([first, created]);

    expect(service.get_book_entries().filter(item => item.id === created.id).length).toBe(1);
  });

  it('does not duplicate an entry when the live snapshot arrives before the local mutation resolves', async () => {
    const snapshots$ = new Subject<BookEntry[]>();
    const first = entry('entry-1');
    const created = entry('entry-2');
    let resolveCreate!: (value: BookEntry) => void;
    const createPromise = new Promise<BookEntry>(resolve => {
      resolveCreate = resolve;
    });
    const { service } = createLiveService(() => snapshots$, {
      createBookEntry: jasmine.createSpy('createBookEntry').and.returnValue(createPromise),
    });
    snapshots$.next([first]);

    const pendingCreation = service.create_book_entry(created);
    snapshots$.next([first, created]);
    resolveCreate(created);
    await pendingCreation;

    expect(service.get_book_entries().filter(item => item.id === created.id).length).toBe(1);
  });

  it('unsubscribes from the previous season before observing the next one', () => {
    const firstSeason$ = new Subject<BookEntry[]>();
    const nextSeason$ = new Subject<BookEntry[]>();
    const nextSeason = '2027/2028';
    const { service, configuration$ } = createLiveService(
      selectedSeason => selectedSeason === season ? firstSeason$ : nextSeason$,
    );
    firstSeason$.next([entry('old-entry')]);

    configuration$.next({ season: nextSeason });
    expect(firstSeason$.observers.length).toBe(0);

    firstSeason$.next([entry('late-old-entry')]);
    nextSeason$.next([{
      ...entry('new-entry'),
      season: nextSeason,
      date: '2027-10-08',
    }]);

    expect(service.get_book_entries().map(item => item.id)).toEqual(['new-entry']);
  });

  it('marks the cache unavailable and asks for a reload when synchronization fails', () => {
    const snapshots$ = new Subject<BookEntry[]>();
    const { service, toastService } = createLiveService(() => snapshots$);
    snapshots$.next([entry('entry-1')]);

    snapshots$.error(new Error('subscription lost'));

    expect(service.is_book_entries_loaded()).toBeFalse();
    expect(toastService.showError).toHaveBeenCalledWith(
      'base comptabilité',
      'La synchronisation comptable est interrompue. Rechargez l’application.',
    );
  });
});