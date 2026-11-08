import { FormBuilder } from '@angular/forms';

import { BookEntry, CUSTOMER_ACCOUNT, FINANCIAL_ACCOUNT, TRANSACTION_ID } from '../../../common/interfaces/accounting.interface';
import { TRANSACTION_DIRECTORY } from '../../../common/interfaces/transaction.definition';
import { BooksEditorComponent } from './books-editor.component';
import { TransactionService } from '../../services/transaction.service';
import { BookService } from '../../services/book.service';
import { SystemDataService } from '../../../common/services/system-data.service';
import { ToastService } from '../../../common/services/toast.service';
import { Location, registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { MembersService } from '../../../common/services/members.service';
import { InvoiceService } from '../../../common/services/invoice.service';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

describe('BooksEditorComponent accounting validation', () => {
  beforeAll(() => registerLocaleData(localeFr));
  function createComponent(
    pastSeason = false,
    bookService = jasmine.createSpyObj<BookService>('BookService', [
      'update_book_entry_documentation', 'update_book_entry',
    ]),
  ) {
    const transactionService = jasmine.createSpyObj('TransactionService', ['get_transaction', 'class_to_ids', 'get_entry_label']);
    transactionService.get_entry_label.and.callFake((entry: BookEntry) =>
      new TransactionService(jasmine.createSpyObj('ToastService', ['showError'])).get_entry_label(entry));
    transactionService.get_transaction.and.callFake((id: TRANSACTION_ID) => TRANSACTION_DIRECTORY[id]);
    transactionService.class_to_ids.and.returnValue([TRANSACTION_ID.virement_stripe_vers_banque]);
    const system = jasmine.createSpyObj<SystemDataService>('SystemDataService', [
      'can_write_accounting_season', 'date_in_season', 'get_season',
    ]);
    system.can_write_accounting_season.and.returnValue(!pastSeason);
    system.date_in_season.and.returnValue(true);
    system.get_season.and.returnValue('2026/2027');
    return new BooksEditorComponent(
      new FormBuilder(),
      bookService,
      transactionService,
      system,
      {} as any,
      {} as any,
      {} as any,
      jasmine.createSpyObj<ToastService>('ToastService', ['showError', 'showSuccess']),
      {} as any,
      {} as any,
      jasmine.createSpyObj<Location>('Location', ['back']),
    );
  }

  const historical: BookEntry = {
    id: 'historical', season: '2025/2026', date: '2026-06-10',
    transaction_id: TRANSACTION_ID.achat_adhérent_par_carte,
    tag: 'ancien', invoice_ref: 'old.pdf', stripeSessionId: 'cs_original',
    stripeTag: 'stripe:original', status: 'confirmed',
    purchasedItems: [{ productId: 'card', beneficiaryMemberIds: ['buyer'], quantity: 1 }],
    bank_report: '2026-06', amounts: { stripe_in: 31 },
    operations: [{ label: 'ancien', member: 'TEST Jean', productCodes: '#CAR12', values: { CAR: 30 } }],
  };

  function loadHistorical(canEdit = true) {
    const books = jasmine.createSpyObj<BookService>('BookService', [
      'update_book_entry_documentation', 'update_book_entry',
    ]);
    books.update_book_entry_documentation.and.callFake(async entry => entry);
    const component = createComponent(true, books);
    component.can_edit_documentation = canEdit;
    component.products_accounts = [{ key: 'CAR', description: 'Cartes' }];
    component.expenses_accounts = [];
    component.init_form();
    component.set_form(structuredClone(historical));
    return { component, books };
  }

  it('only enables labels, tag and invoice reference for authorized historical documentation', () => {
    const { component } = loadHistorical();
    expect(component.documentary_mode).toBeTrue();
    expect(component.season).toBe(historical.season);
    expect(component.form.get('tag')?.enabled).toBeTrue();
    expect(component.form.get('invoice_ref')?.enabled).toBeTrue();
    expect(component.operations.at(0).get('label')?.enabled).toBeTrue();
    for (const key of ['date', 'transaction_id', 'amounts', 'stripeTag', 'deposit_ref', 'bank_name', 'cheque_number']) {
      expect(component.form.get(key)?.disabled).withContext(key).toBeTrue();
    }
    expect(component.operations.at(0).get('member')?.disabled).toBeTrue();
    expect(component.operations.at(0).get('values')?.disabled).toBeTrue();
  });

  it('preserves every accounting field and bypasses audit when saving historical labels', async () => {
    const { component, books } = loadHistorical();
    component.form.get('tag')?.setValue('nouveau');
    component.operations.at(0).get('label')?.setValue('nouveau libellé');
    const audit = spyOn(component, 'book_entry_balance_error').and.callThrough();

    await component.save_documentation();

    expect(books.update_book_entry_documentation).toHaveBeenCalledOnceWith({
      ...historical, tag: 'nouveau',
      operations: [{ ...historical.operations[0], label: 'nouveau libellé' }],
    });
    expect(books.update_book_entry).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('leaves all historical fields disabled without documentary permission', async () => {
    const { component, books } = loadHistorical(false);
    expect(component.form.disabled).toBeTrue();
    await component.save_documentation();
    expect(books.update_book_entry_documentation).not.toHaveBeenCalled();
  });

  it('submits documentary edits without rebuilding amounts or operations', () => {
    const { component } = loadHistorical();
    const saveDocumentation = spyOn(component, 'save_documentation').and.resolveTo();
    const saveAccounting = spyOn(component, 'save_book_entry');
    component.onSubmit();
    expect(saveDocumentation).toHaveBeenCalledOnceWith();
    expect(saveAccounting).not.toHaveBeenCalled();
  });

  for (const { pastSeason, canEdit } of [
    { pastSeason: true, canEdit: true },
    { pastSeason: true, canEdit: false },
    { pastSeason: false, canEdit: true },
  ]) {
    it(`opens the compact form directly (pastSeason=${pastSeason}, permission=${canEdit})`, async () => {
      const books = jasmine.createSpyObj<BookService>('BookService', [
        'update_book_entry_documentation', 'update_book_entry',
      ]);
      books.update_book_entry_documentation.and.callFake(async entry => entry);
      const system = jasmine.createSpyObj<SystemDataService>('SystemDataService', [
        'can_write_accounting_season', 'date_in_season', 'get_season',
      ]);
      system.can_write_accounting_season.and.returnValue(!pastSeason);
      system.date_in_season.and.returnValue(true);
      system.get_season.and.returnValue('2026/2027');
      await TestBed.configureTestingModule({
        imports: [BooksEditorComponent],
        providers: [
          { provide: BookService, useValue: books },
          TransactionService,
          { provide: SystemDataService, useValue: system },
          { provide: MembersService, useValue: {} },
          { provide: InvoiceService, useValue: {} },
          { provide: NgbModal, useValue: {} },
          { provide: ToastService, useValue: jasmine.createSpyObj<ToastService>('ToastService', ['showSuccess', 'showError']) },
          { provide: ActivatedRoute, useValue: {} },
          { provide: Router, useValue: {} },
          { provide: Location, useValue: jasmine.createSpyObj<Location>('Location', ['back']) },
        ],
      }).compileComponents();
      spyOn(BooksEditorComponent.prototype, 'ngOnInit');
      const fixture = TestBed.createComponent(BooksEditorComponent);
      const component = fixture.componentInstance;
      component.can_edit_documentation = canEdit;
      component.products_accounts = [{ key: 'CAR', description: 'Cartes' }];
      component.expenses_accounts = [];
      component.members = [];
      component.init_form();
      const entry = pastSeason ? structuredClone(historical) : {
        ...structuredClone(historical), season: '2026/2027', amounts: { stripe_in: 30 },
      };
      component.set_form(entry);
      component.form_ready = true;
      const audit = spyOn(component, 'book_entry_balance_error').and.callThrough();
      fixture.detectChanges();
      const root: HTMLElement = fixture.nativeElement;
      expect(root.querySelector<HTMLInputElement>('input[type="date"]')?.disabled).toBe(pastSeason);
      expect(root.querySelector<HTMLInputElement>('#value0')?.disabled).toBe(pastSeason);
      expect(root.querySelector<HTMLInputElement>('#tag')?.disabled).toBe(pastSeason && !canEdit);
      expect(!!root.querySelector('app-custom-dropdown')).toBe(!pastSeason);
      expect(!!root.querySelector('button[aria-label="Déverrouiller les montants"]')).toBe(!pastSeason);
      expect(root.querySelector('.account-cell label')?.textContent?.trim()).toBe('CAR');
      expect(root.querySelector('input[formControlName="label"]')).toBeNull();
      const accountCell = root.querySelector<HTMLElement>('.account-cell')!;
      expect(getComputedStyle(accountCell).minWidth).toBe('60px');
      expect(getComputedStyle(accountCell).maxWidth).toBe('120px');
      expect(getComputedStyle(root.querySelector<HTMLElement>('.editor-actions')!).position).toBe('sticky');
      expect(root.querySelector('.book-entry-json')?.textContent).toContain(entry.id);
      expect(root.querySelector('.book-entry-json')?.textContent).toBe(JSON.stringify(entry));
      expect(root.querySelector('.book-entry-json')?.closest('details')).toBeNull();
      const jsonSwitch = root.querySelector<HTMLInputElement>('#pretty-json')!;
      expect(jsonSwitch.checked).toBeFalse();
      jsonSwitch.click();
      fixture.detectChanges();
      expect(root.querySelector('.book-entry-json')?.textContent).toBe(JSON.stringify(entry, null, 2));
      expect(root.querySelector('.book-entry-json')?.classList.contains('json-indented')).toBeTrue();
      jsonSwitch.click();
      fixture.detectChanges();
      expect(root.querySelector('.book-entry-json')?.textContent).toBe(JSON.stringify(entry));
      expect(root.querySelector('.book-entry-json')?.classList.contains('json-indented')).toBeFalse();
      if (pastSeason) {
        expect(root.textContent).toContain('Saison 2025/2026 verrouillée');
        expect(audit).not.toHaveBeenCalled();
      } else {
        expect(root.textContent).toContain('Écriture équilibrée');
        expect(root.textContent).not.toContain('Modifier la documentation');
      }
      if (canEdit) {
        const tag = root.querySelector<HTMLInputElement>('#tag')!;
        tag.value = 'nouveau tag';
        tag.dispatchEvent(new Event('input'));
        fixture.detectChanges();
        expect(tag.classList.contains('field-modified')).toBeTrue();
        root.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
        await fixture.whenStable();
        expect(books.update_book_entry_documentation).toHaveBeenCalledOnceWith({
          ...entry, tag: 'nouveau tag',
        });
        expect(books.update_book_entry).not.toHaveBeenCalled();
      } else {
        expect(root.querySelector('button[type="submit"]')).toBeNull();
      }
      const identity = root.querySelector<HTMLElement>('.operation-identity')!;
      expect(identity.textContent).toContain('Adhérent');
      component.init_form();
      component.set_form({
        ...entry, transaction_id: TRANSACTION_ID.vente_en_espèces,
        amounts: { cashbox_in: 30 },
      });
      fixture.detectChanges();
      const labelIdentity = root.querySelector<HTMLElement>('.operation-identity')!;
      expect(labelIdentity.textContent).toContain('Intitulé');
      expect(labelIdentity.className).toBe(identity.className);
      expect(labelIdentity.parentElement?.classList.contains('align-items-start')).toBeTrue();
      expect(root.querySelector('app-custom-dropdown')).toBeNull();
      expect(labelIdentity.querySelector('input[formControlName="label"]')).not.toBeNull();
      fixture.destroy();
    });
  }

  it('opens current-season accounting directly and resets changes without changing layout', () => {
    const component = loadCheque();
    expect(component.form.get('date')?.enabled).toBeTrue();
    component.form.get('tag')?.setValue('changed');
    component.reset_changes();
    expect(component.form.get('tag')?.value).toBe(component.selected_book_entry.tag);
    expect(component.form.get('date')?.enabled).toBeTrue();
  });

  it('uses documentation-only saving for a current-season entry', async () => {
    const component = loadCheque();
    component.can_edit_documentation = true;
    const saveDocumentation = spyOn(component, 'save_documentation').and.resolveTo();
    const saveAccounting = spyOn(component, 'save_book_entry');
    component.form.get('tag')?.setValue('documentation');
    expect(component.form.get('date')?.enabled).toBeTrue();
    expect(component.form.get('tag')?.enabled).toBeTrue();
    component.onSubmit();
    expect(saveDocumentation).toHaveBeenCalledOnceWith();
    expect(saveAccounting).not.toHaveBeenCalled();
    await Promise.resolve();
  });

  it('previews amount changes and requires confirmation before saving accounting', () => {
    const component = loadCheque();
    const cashIndex = component.financial_accounts.findIndex(account => account.key === FINANCIAL_ACCOUNT.CASHBOX_debit);
    component.amounts.at(cashIndex).setValue('60');
    component.operations.at(0).get(['values', 0])?.setValue('60');
    const save = spyOn(component, 'save_book_entry');
    component.onSubmit();
    expect(save).not.toHaveBeenCalled();
    expect(component.correction_review).toBeTrue();
    expect(component.correction_changes).toContain({
      field: 'Caisse — entrée', before: '30.00 €', after: '60.00 €',
    });
    component.onSubmit();
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('highlights actual changes and clears highlighting when the original value is restored', () => {
    const component = loadCheque();
    component.can_edit_documentation = true;
    expect(component.is_modified(component.form.get('tag'))).toBeFalse();
    component.form.get('tag')?.setValue('unsaved');
    expect(component.is_modified(component.form.get('tag'))).toBeTrue();
    expect(component.has_accounting_changes).toBeFalse();
    component.reset_changes();
    expect(component.is_modified(component.form.get('tag'))).toBeFalse();
    expect(component.form.get('tag')?.value).toBe(component.selected_book_entry.tag);
  });

  it('does not count equivalent numeric formats or empty zeroes as accounting changes', () => {
    const component = loadCheque();
    const cashIndex = component.financial_accounts.findIndex(account => account.key === FINANCIAL_ACCOUNT.CASHBOX_debit);
    component.amounts.at(cashIndex).setValue('30,00');
    component.operations.at(0).get(['values', 0])?.setValue('30.0');
    component.operations.at(0).get(['optional_accounts', 0])?.setValue('0');
    expect(component.has_accounting_changes).toBeFalse();
    expect(component.is_modified(component.amounts.at(cashIndex))).toBeFalse();
    expect(component.correction_changes).toEqual([]);
  });

  it('does not hide invalid financial input behind documentation saving', () => {
    const component = loadCheque();
    component.can_edit_documentation = true;
    const cashIndex = component.financial_accounts.findIndex(account => account.key === FINANCIAL_ACCOUNT.CASHBOX_debit);
    component.amounts.at(cashIndex).setValue('invalid');
    const documentation = spyOn(component, 'save_documentation').and.resolveTo();
    const accounting = spyOn(component, 'save_book_entry');
    component.onSubmit();
    expect(documentation).not.toHaveBeenCalled();
    expect(accounting).not.toHaveBeenCalled();
  });

  it('does not accumulate payment controls when resetting changes repeatedly', () => {
    const component = loadCheque();
    component.can_edit_documentation = true;
    const amountCount = component.amounts.length;
    for (let index = 0; index < 3; index++) {
      component.reset_changes();
      expect(component.amounts.length).toBe(amountCount);
      expect(component.operations.length).toBe(component.selected_book_entry.operations.length);
      expect(component.form_balance_error).toBe(0);
    }
  });

  it('does not invent fee operations for documentary changes to a current payout', async () => {
    const books = jasmine.createSpyObj<BookService>('BookService', [
      'update_book_entry_documentation', 'update_book_entry',
    ]);
    books.update_book_entry_documentation.and.callFake(async entry => entry);
    const component = createComponent(false, books);
    component.can_edit_documentation = true;
    component.expenses_accounts = [{ key: 'PSP', description: 'Frais PSP' }];
    component.products_accounts = [];
    const payout: BookEntry = {
      id: 'payout', season: '2026/2027', date: '2026-11-05',
      transaction_id: TRANSACTION_ID.virement_stripe_vers_banque,
      amounts: { stripe_out: 30, bank_in: 30 }, operations: [],
    };
    component.init_form();
    component.set_form(payout);
    expect(component.has_accounting_changes).toBeFalse();
    component.form.get('tag')?.setValue('document');
    component.onSubmit();
    await Promise.resolve();
    expect(books.update_book_entry_documentation).toHaveBeenCalledOnceWith({
      ...payout, tag: 'document', invoice_ref: undefined,
    });
  });

  for (const pastSeason of [true, false]) {
    it(`defers invoice changes until saving (pastSeason=${pastSeason})`, async () => {
      const { component, books } = loadHistorical();
      component.documentary_mode = pastSeason;
      await component.clear_invoice_ref();
      expect(component.form.get('invoice_ref')?.value).toBe('');
      expect(component.selected_book_entry.invoice_ref).toBe('old.pdf');
      expect(books.update_book_entry_documentation).not.toHaveBeenCalled();
      expect(books.update_book_entry).not.toHaveBeenCalled();
    });
  }

  it('preserves fulfillment and bank metadata during accounting corrections without inventing cheque references', () => {
    const books = jasmine.createSpyObj<BookService>('BookService', [
      'update_book_entry_documentation', 'update_book_entry',
    ]);
    books.update_book_entry.and.resolveTo();
    const component = createComponent(false, books);
    component.products_accounts = [{ key: 'CAR', description: 'Cartes' }];
    component.expenses_accounts = [];
    component.book_entry_id = historical.id;
    const entry = { ...structuredClone(historical), season: '2026/2027', amounts: { stripe_in: 30 } };
    component.init_form();
    component.set_form(entry);
    component.form.get('tag')?.setValue('correction');
    component.onSubmit();
    expect(books.update_book_entry).toHaveBeenCalledOnceWith({
      ...entry, tag: 'correction', deposit_ref: undefined,
    });
    expect(component.correction_changes.some(change => change.field === 'Référence chèque')).toBeFalse();
  });

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

  for (const protectedMode of [true, false]) {
    it(`loads a received transfer without dropping bank_in (protected=${protectedMode})`, () => {
      const component = createComponent();
      component.protected_mode = protectedMode;
      component.products_accounts = [{ key: 'CAR', description: 'Cartes' }];
      component.expenses_accounts = [];
      component.init_form();
      const entry: BookEntry = {
        id: 'received-transfer', season: '2026/2027', date: '2026-10-08',
        transaction_id: TRANSACTION_ID.achat_adhérent_par_virement,
        amounts: { [FINANCIAL_ACCOUNT.BANK_debit]: 133 },
        operations: [{
          label: 'règlement du virement annoncé', member: 'TEST Jean',
          values: { [CUSTOMER_ACCOUNT.DEBT_credit]: 133 },
        }],
      };
      component.set_form(entry);
      component.valueChanges_subscribe();
      const bankIndex = component.financial_accounts.findIndex(account => account.key === FINANCIAL_ACCOUNT.BANK_debit);
      expect(bankIndex).toBeGreaterThanOrEqual(0);
      expect(component.amounts.at(bankIndex).value).toBe(133);
      expect(component.amounts.at(bankIndex).enabled).toBeTrue();
      expect(component.form_balance_error).toBe(0);
      expect(component.form.valid).toBeTrue();
      expect(component.transaction_label(entry.transaction_id)).toBe('VIREMENT');
      component.lock_unlock_financial_accounts();
      component.lock_unlock_financial_accounts();
      expect(component.amounts.at(bankIndex).enabled).toBeTrue();
      const save = spyOn(component, 'save_book_entry');
      component.onSubmit();
      expect(save).toHaveBeenCalledOnceWith(entry.amounts, entry.operations);
      component.amounts.at(bankIndex).setValue('130');
      expect(component.form_balance_error).toBe(-3);
    });
  }

  it('keeps an announced transfer as a debt without requiring a bank receipt', () => {
    const component = createComponent();
    component.protected_mode = true;
    component.products_accounts = [{ key: 'CAR', description: 'Cartes' }];
    component.expenses_accounts = [];
    component.init_form();
    const entry: BookEntry = {
      id: 'announced-transfer', season: '2026/2027', date: '2026-10-08',
      transaction_id: TRANSACTION_ID.achat_adhérent_par_virement,
      amounts: {},
      operations: [{
        label: 'achat adhérent TEST Jean', member: 'TEST Jean',
        values: { CAR: 30, [CUSTOMER_ACCOUNT.DEBT_debit]: 30 },
      }],
    };
    component.set_form(entry);
    expect(component.financial_accounts.length).toBe(1);
    expect(component.financial_accounts[0].key).toBe(CUSTOMER_ACCOUNT.DEBT_debit);
    expect(component.amounts.at(0).value).toBe(30);
    expect(component.form_balance_error).toBe(0);
    expect(component.form.valid).toBeTrue();
    expect(component.transaction_label(entry.transaction_id)).toBe('virement annoncé');
  });

  function correctCheque(component: BooksEditorComponent) {
    const assetIndex = component.optional_accounts.findIndex(account => account.key === CUSTOMER_ACCOUNT.ASSET_credit);
    const cashIndex = component.financial_accounts.findIndex(account => account.key === FINANCIAL_ACCOUNT.CASHBOX_debit);
    component.amounts.at(cashIndex).setValue('60');
    component.operations.at(0).get(['optional_accounts', assetIndex])?.setValue('30');
    component.operations.at(0).get('label')?.setValue('  Correction : chèque de 60 EUR, carte manquante à acheter avec avoir  ');
  }

  it('adds the asset grant option to member cheque and transfer payments', () => {
    for (const id of [
      TRANSACTION_ID.achat_adhérent_par_chèque,
      TRANSACTION_ID.achat_adhérent_par_virement,
    ]) {
      expect(TRANSACTION_DIRECTORY[id].optional_accounts?.map(account => account.key))
        .toContain(CUSTOMER_ACCOUNT.ASSET_credit);
    }
    for (const id of [
      TRANSACTION_ID.achat_adhérent_en_espèces,
      TRANSACTION_ID.achat_adhérent_par_carte,
    ]) {
      expect(TRANSACTION_DIRECTORY[id].optional_accounts?.map(account => account.key))
        .not.toContain(CUSTOMER_ACCOUNT.ASSET_credit);
    }
    expect(TRANSACTION_DIRECTORY[TRANSACTION_ID.achat_adhérent_par_virement].optional_accounts
      ?.map(account => account.key))
      .not.toContain(CUSTOMER_ACCOUNT.DEBT_debit);
    expect(TRANSACTION_DIRECTORY[TRANSACTION_ID.achat_adhérent_par_virement].financial_accounts
      .find(account => account.key === CUSTOMER_ACCOUNT.DEBT_debit)?.label)
      .toBe('Virement annoncé');
  });

  it('balances an announced 60 EUR transfer with a 30 EUR purchase and a 30 EUR asset grant', () => {
    const component = createComponent();
    component.protected_mode = true;
    component.products_accounts = [{ key: 'CAR', description: 'Cartes' }];
    component.expenses_accounts = [];
    component.init_form();
    const entry: BookEntry = {
      id: 'announced-transfer-overpayment',
      season: '2026/2027',
      date: '2026-11-03',
      transaction_id: TRANSACTION_ID.achat_adhérent_par_virement,
      amounts: { [CUSTOMER_ACCOUNT.DEBT_debit]: 60 },
      operations: [{
        label: 'achat adhérent TEST Jean',
        member: 'TEST Jean',
        values: {
          CAR: 30,
          [CUSTOMER_ACCOUNT.ASSET_credit]: 30,
        },
      }],
    };

    component.set_form(entry);

    expect(component.form_balance_error).toBe(0);
    expect(component.form.valid).toBeTrue();
    expect(component.amounts.at(0).value).toBe(60);
    const assetIndex = component.optional_accounts.findIndex(account => account.key === CUSTOMER_ACCOUNT.ASSET_credit);
    expect(assetIndex).toBeGreaterThanOrEqual(0);
    expect(component.operations.at(0).get(['optional_accounts', assetIndex])?.value).toBe('30');
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