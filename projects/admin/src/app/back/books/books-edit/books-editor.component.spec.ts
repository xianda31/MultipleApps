import { FormBuilder } from '@angular/forms';

import { BookEntry, CUSTOMER_ACCOUNT, FINANCIAL_ACCOUNT, TRANSACTION_ID } from '../../../common/interfaces/accounting.interface';
import { TRANSACTION_DIRECTORY } from '../../../common/interfaces/transaction.definition';
import { BooksEditorComponent } from './books-editor.component';

describe('BooksEditorComponent accounting validation', () => {
  function createComponent() {
    const transactionService = jasmine.createSpyObj('TransactionService', ['get_transaction', 'class_to_ids']);
    transactionService.get_transaction.and.callFake((id: TRANSACTION_ID) => TRANSACTION_DIRECTORY[id]);
    transactionService.class_to_ids.and.returnValue([TRANSACTION_ID.virement_stripe_vers_banque]);
    return new BooksEditorComponent(
      new FormBuilder(),
      {} as any,
      transactionService,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
  }

  it('rejects the malformed payout found in production', () => {
    const component = createComponent();

    expect(component.book_entry_balance_error({
      id: 'payout',
      season: '2026/2027',
      date: '2026-08-17',
      transaction_id: TRANSACTION_ID.virement_stripe_vers_banque,
      amounts: {
        [FINANCIAL_ACCOUNT.STRIPE_credit]: 93,
        [FINANCIAL_ACCOUNT.BANK_debit]: 120.38,
      },
      operations: [],
    })).toBe(27.38);
  });

  it('accepts the corrected payout with PSP fees', () => {
    const component = createComponent();

    expect(component.book_entry_balanced({
      id: 'payout',
      season: '2026/2027',
      date: '2026-08-17',
      transaction_id: TRANSACTION_ID.virement_stripe_vers_banque,
      amounts: {
        [FINANCIAL_ACCOUNT.STRIPE_credit]: 123,
        [FINANCIAL_ACCOUNT.BANK_debit]: 120.38,
      },
      operations: [{ label: 'frais PSP', values: { PSP: 2.62 } }],
    })).toBeTrue();
  });

  it('adds the configured PSP fee field when an old payout has no operations', () => {
    const component = createComponent();
    const malformedPayout = {
      id: 'payout',
      season: '2026/2027',
      date: '2026-08-17',
      transaction_id: TRANSACTION_ID.virement_stripe_vers_banque,
      amounts: {
        [FINANCIAL_ACCOUNT.STRIPE_credit]: 93,
        [FINANCIAL_ACCOUNT.BANK_debit]: 120.38,
      },
      operations: [],
    };
    component.expenses_accounts = [{ key: 'PSP', description: 'Frais de paiement par carte' }];
    component.products_accounts = [];
    (component as any).CB_fees_account = 'PSP';
    component.init_form();
    component.selected_book_entry = malformedPayout;

    component.set_form(malformedPayout);

    expect(component.operations.length).toBe(1);
    expect(component.operations.at(0).get('values')?.value).toEqual(['']);
    expect(component.form_balance_error).toBe(27.38);
    expect(component.form.invalid).toBeTrue();
  });

  function loadCheque() {
    const component = createComponent();
    component.products_accounts = [{ key: 'CAR', description: 'Cartes' }];
    component.expenses_accounts = [];
    component.init_form();
    const entry: BookEntry = {
      id: 'cheque-to-correct',
      season: '2026/2027',
      date: '2026-10-29',
      transaction_id: TRANSACTION_ID.achat_adhérent_par_chèque,
      cheque_ref: 'BNK123456',
      deposit_ref: 'deposit-1',
      amounts: { [FINANCIAL_ACCOUNT.CASHBOX_debit]: 30 },
      operations: [{
        label: 'vendu par accueil',
        member: 'TEST Jean',
        productCodes: '#CAR12',
        values: { CAR: 30 },
      }],
    };
    component.selected_book_entry = entry;
    component.set_form(entry);
    component.valueChanges_subscribe();
    return component;
  }

  function correctCheque(component: BooksEditorComponent) {
    const assetIndex = component.optional_accounts.findIndex(account => account.key === CUSTOMER_ACCOUNT.ASSET_credit);
    const cashIndex = component.financial_accounts.findIndex(account => account.key === FINANCIAL_ACCOUNT.CASHBOX_debit);
    component.amounts.at(cashIndex).setValue('60');
    component.operations.at(0).get(['optional_accounts', assetIndex])?.setValue('30');
    component.operations.at(0).get('label')?.setValue('  Correction : chèque de 60 EUR, carte manquante à acheter avec avoir  ');
  }

  it('only adds the asset grant option to member cheque purchases', () => {
    expect(TRANSACTION_DIRECTORY[TRANSACTION_ID.achat_adhérent_par_chèque].optional_accounts?.map(account => account.key))
      .toContain(CUSTOMER_ACCOUNT.ASSET_credit);
    for (const id of [
      TRANSACTION_ID.achat_adhérent_en_espèces,
      TRANSACTION_ID.achat_adhérent_par_carte,
      TRANSACTION_ID.achat_adhérent_par_virement,
    ]) {
      expect(TRANSACTION_DIRECTORY[id].optional_accounts?.map(account => account.key))
        .not.toContain(CUSTOMER_ACCOUNT.ASSET_credit);
    }
  });

  it('balances a 60 EUR cheque with one 30 EUR card and a 30 EUR asset grant', () => {
    const component = loadCheque();
    expect(component.operations_grand_total()).toBe(30);
    correctCheque(component);

    expect(component.form_balance_error).toBe(0);
    expect(component.operations_grand_total()).toBe(60);
    expect(component.form.valid).toBeTrue();
    const save = spyOn(component, 'save_book_entry');
    component.onSubmit();
    expect(save).toHaveBeenCalledOnceWith(
      { [FINANCIAL_ACCOUNT.CASHBOX_debit]: 60 },
      [{
        label: 'Correction : chèque de 60 EUR, carte manquante à acheter avec avoir',
        member: 'TEST Jean',
        productCodes: '#CAR12',
        values: { CAR: 30, [CUSTOMER_ACCOUNT.ASSET_credit]: 30 },
      }],
    );
  });

  it('loads the asset grant and correction description again without losing them', () => {
    const component = loadCheque();
    const corrected: BookEntry = {
      ...component.selected_book_entry,
      amounts: { [FINANCIAL_ACCOUNT.CASHBOX_debit]: 60 },
      operations: [{
        label: 'Correction chèque 60 EUR',
        member: 'TEST Jean',
        productCodes: '#CAR12',
        values: { CAR: 30, [CUSTOMER_ACCOUNT.ASSET_credit]: 30 },
      }],
    };
    component.init_form();
    component.set_form(corrected);
    component.valueChanges_subscribe();

    expect(component.form_balance_error).toBe(0);
    expect(component.operations_grand_total()).toBe(60);
    const save = spyOn(component, 'save_book_entry');
    component.onSubmit();
    expect(save).toHaveBeenCalledOnceWith(corrected.amounts, corrected.operations);
  });

  it('detects an incorrect grant rather than accepting a mismatched cheque', () => {
    const component = loadCheque();
    correctCheque(component);
    const assetIndex = component.optional_accounts.findIndex(account => account.key === CUSTOMER_ACCOUNT.ASSET_credit);
    component.operations.at(0).get(['optional_accounts', assetIndex])?.setValue('20');

    expect(component.form_balance_error).toBe(10);
    expect(component.operations_grand_total()).toBe(50);
  });

  it('keeps the automatic purchase label when the cheque description is empty', () => {
    const component = loadCheque();
    component.operations.at(0).get('label')?.setValue(' ');
    const save = spyOn(component, 'save_book_entry');
    component.onSubmit();
    expect(save.calls.mostRecent().args[1][0].label).toBe('achat adhérent TEST Jean');
  });

  it('balances a cheque using all four customer balance adjustments', () => {
    const component = loadCheque();
    const values: Record<string, string> = {
      [CUSTOMER_ACCOUNT.ASSET_debit]: '10',
      [CUSTOMER_ACCOUNT.DEBT_credit]: '15',
      [CUSTOMER_ACCOUNT.DEBT_debit]: '5',
      [CUSTOMER_ACCOUNT.ASSET_credit]: '20',
    };
    component.optional_accounts.forEach((account, index) => {
      component.operations.at(0).get(['optional_accounts', index])?.setValue(values[account.key]);
    });
    const cashIndex = component.financial_accounts.findIndex(account => account.key === FINANCIAL_ACCOUNT.CASHBOX_debit);
    component.amounts.at(cashIndex).setValue('50');

    expect(component.form_balance_error).toBe(0);
  });

  it('preserves the existing cheque label without exposing a correction field', () => {
    const component = loadCheque();
    const save = spyOn(component, 'save_book_entry');
    component.onSubmit();
    expect(save.calls.mostRecent().args[1][0].label).toBe('vendu par accueil');
  });
});