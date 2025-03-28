import { Component, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Bank_accounts, BookEntry, ENTRY_TYPE, FINANCIAL_ACCOUNT, Liquidities } from '../../../../common/accounting.interface';
import { SystemDataService } from '../../../../common/services/system-data.service';
import { BookService } from '../book.service';
import { get_transaction } from '../../../../common/transaction.definition';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { Router } from '@angular/router';
import { ToastService } from '../../../../common/toaster/toast.service';
import { tap, switchMap, combineLatest } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { threedigitsPipe } from '../../../../common/pipes/three_digits.pipe';

@Component({
  selector: 'app-bank-reconciliation',
  standalone: true,
  encapsulation: ViewEncapsulation.None,   // nécessaire pour que les tooltips fonctionnent
  imports: [CommonModule, FormsModule, NgbModule, threedigitsPipe],
  templateUrl: './bank-reconciliation.component.html',
  styleUrl: './bank-reconciliation.component.scss'
})
export class BankReconciliationComponent {

  current_season!: string;
  initial_liquidities: Liquidities = { cash: 0, bank: 0, savings: 0 };
  bank_book_entries: BookEntry[] = [];
  bank_accounts = Object.values(Bank_accounts) as FINANCIAL_ACCOUNT[];
  bank_reports: string[] = [];

  constructor(
    private bookService: BookService,
    private router: Router,
    private ToastService: ToastService,
    private systemDataService: SystemDataService,
  ) { }

  ngOnInit() {

    this.bank_reports = this.systemDataService.get_season_months(new Date());

    this.systemDataService.get_configuration().pipe(
      map((conf) => {
        this.current_season = conf.season;
        return conf.season;
      }),
      switchMap((season) => combineLatest([
        this.systemDataService.get_balance_sheet_initial_amounts(season),
        this.bookService.list_book_entries$(season)
      ])))
      .subscribe(([liquidities, book_entries]) => {
        this.initial_liquidities = liquidities;
        console.log('initial_liquidities', this.initial_liquidities);
        this.bank_book_entries = book_entries.filter(book_entry => this.bank_accounts.some(op => book_entry.amounts[op] !== undefined));
      });
  }


  // utilities

  transaction_label(op_type: ENTRY_TYPE): string {
    return get_transaction(op_type).label;
  }

  book_label(book_entry: BookEntry): string {
    let transaction = get_transaction(book_entry.bank_op_type);
    if (transaction.require_deposit_ref) {
      return book_entry.deposit_ref!;
    } else {
      return (book_entry.operations[0]?.label ?? '');
    }
  }
  show_book_entry(book_entry_id: string) {
    this.router.navigate(['/books/editor', book_entry_id]);
  }

  set_bank_report(book_entry: BookEntry, report: string) {
    if (book_entry.bank_report === null) {
      book_entry.bank_report = report;
    } else {
      book_entry.bank_report = null;
    }
    this.bookService.update_book_entry(book_entry);
  }
  update_bank_report(book_entry: BookEntry) {
    let date = book_entry.date.slice(2, 7);
    let report = book_entry.bank_report;
    if (report && report < date) {
      this.ToastService.showWarningToast('pointage annulé', 'le relevé ne peut être antérieur à l\'opération');
      book_entry.bank_report = null;
    }
    this.bookService.update_book_entry(book_entry);
  }



  movement_in(report: string): { bank: number, savings: number } {
    let book_entries = this.bank_book_entries.filter(book_entry => book_entry.bank_report === report);
    let bank = book_entries.reduce((acc, book_entry) => {
      return acc + (book_entry.amounts[FINANCIAL_ACCOUNT.BANK_debit] ?? 0);
    }, 0);
    let savings = book_entries.reduce((acc, book_entry) => {
      return acc + (book_entry.amounts[FINANCIAL_ACCOUNT.SAVING_debit] ?? 0);
    }, 0);
    return { bank, savings };
  }

  movement_out(report: string): { bank: number, savings: number } {
    let book_entries = this.bank_book_entries.filter(book_entry => book_entry.bank_report === report);
    let bank = book_entries.reduce((acc, book_entry) => {
      return acc + (book_entry.amounts[FINANCIAL_ACCOUNT.BANK_credit] ?? 0);
    }, 0);
    let savings = book_entries.reduce((acc, book_entry) => {
      return acc + (book_entry.amounts[FINANCIAL_ACCOUNT.SAVING_credit] ?? 0);
    }, 0);
    return { bank, savings };
  }
  balance(report: string): { bank: number, savings: number } {
    return this.bank_reports.filter(r => r.localeCompare(report) <= 0).reduce((acc, report) => {
      let in_ = this.movement_in(report);
      let out = this.movement_out(report);
      return { bank: acc.bank + in_.bank - out.bank, savings: acc.savings + in_.savings - out.savings };
    }
      , { bank: this.initial_liquidities.bank, savings: this.initial_liquidities.savings });
  }


}
