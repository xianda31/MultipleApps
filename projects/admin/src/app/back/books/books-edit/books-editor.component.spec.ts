import { FormBuilder } from '@angular/forms';

import { FINANCIAL_ACCOUNT, TRANSACTION_ID } from '../../../common/interfaces/accounting.interface';
import { TRANSACTION_DIRECTORY } from '../../../common/interfaces/transaction.definition';
import { BooksEditorComponent } from './books-editor.component';

describe('BooksEditorComponent accounting validation', () => {
  function createComponent() {
    const transactionService = jasmine.createSpyObj('TransactionService', ['get_transaction', 'class_to_ids']);
    transactionService.get_transaction.and.returnValue(TRANSACTION_DIRECTORY[TRANSACTION_ID.virement_stripe_vers_banque]);
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
});