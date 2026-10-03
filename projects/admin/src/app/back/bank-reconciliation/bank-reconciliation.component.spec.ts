import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BookEntry, CUSTOMER_ACCOUNT, FINANCIAL_ACCOUNT, TRANSACTION_ID, TRANSFER_PROMISE_REF_PREFIX } from '../../common/interfaces/accounting.interface';
import { BankReconciliationComponent } from './bank-reconciliation.component';

describe('BankReconciliationComponent', () => {
  let component: BankReconciliationComponent;
  let fixture: ComponentFixture<BankReconciliationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BankReconciliationComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BankReconciliationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('settles an announced transfer into bank and clears the member debt', async () => {
    const promise = {
      id: 'promise-1',
      season: '2026/2027',
      date: '2026-10-01',
      transaction_id: TRANSACTION_ID.achat_adhérent_par_virement,
      amounts: {},
      operations: [{
        label: 'vente',
        member: 'TEST Jean',
        values: { ADH: 30, [CUSTOMER_ACCOUNT.DEBT_debit]: 30 },
      }],
    } as BookEntry;
    const bookService = (component as any).bookService;
    spyOn(bookService, 'create_book_entry').and.resolveTo({ id: 'settlement-1' });
    spyOn((component as any).ToastService, 'showSuccess');
    component.current_season = '2026/2027';
    component.transfer_receipt_dates[promise.id] = '2026-10-02';
    component.transfer_reports[promise.id] = '26-10';

    await component.settle_transfer(promise);

    expect(bookService.create_book_entry).toHaveBeenCalledWith(jasmine.objectContaining({
      date: '2026-10-02',
      transaction_id: TRANSACTION_ID.achat_adhérent_par_virement,
      amounts: { [FINANCIAL_ACCOUNT.BANK_debit]: 30 },
      bank_report: '26-10',
      deposit_ref: `${TRANSFER_PROMISE_REF_PREFIX}${promise.id}`,
      operations: [{
        label: 'règlement du virement annoncé',
        member: 'TEST Jean',
        values: { [CUSTOMER_ACCOUNT.DEBT_credit]: 30 },
      }],
    }));

    const settlement = bookService.create_book_entry.calls.mostRecent().args[0] as BookEntry;
    expect(component.transaction_label(settlement)).toBe('VIREMENT');
  });
});
