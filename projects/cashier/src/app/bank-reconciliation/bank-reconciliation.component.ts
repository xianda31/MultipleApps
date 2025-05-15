import { Component, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BookEntry, TRANSACTION_ID, FINANCIAL_ACCOUNT } from '../../../../common/accounting.interface';
import { SystemDataService } from '../../../../common/services/system-data.service';
import { BookService } from '../book.service';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { Router } from '@angular/router';
import { ToastService } from '../../../../common/toaster/toast.service';
import { switchMap, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { TransactionService } from '../transaction.service';
import { FinancialReportService } from '../financial_report.service';
import { Balance_sheet } from '../../../../common/balance.interface';

@Component({
  selector: 'app-bank-reconciliation',
  standalone: true,
  encapsulation: ViewEncapsulation.None,   // nécessaire pour que les tooltips fonctionnent
  imports: [CommonModule, FormsModule, NgbModule],
  templateUrl: './bank-reconciliation.component.html',
  styleUrl: './bank-reconciliation.component.scss'
})
export class BankReconciliationComponent {
  truncature = '1.2-2';// '1.2-2';  //
  always_collapsed = true;
  current_season!: string;
  former_balance_sheet !: Balance_sheet;
  bank_book_entries: BookEntry[] = [];
  // bank_accounts = Object.values(Bank_accounts).slice().reverse() as FINANCIAL_ACCOUNT[];
  bank_accounts : FINANCIAL_ACCOUNT[] = [
     FINANCIAL_ACCOUNT.BANK_credit,
     FINANCIAL_ACCOUNT.BANK_debit,
    // [FINANCIAL_ACCOUNT.SAVING_debit]: 'saving_in',
    // [FINANCIAL_ACCOUNT.SAVING_credit]: 'saving_out',
];
    bank_reports: string[] = [];

  constructor(
    private bookService: BookService,
    private transactionService: TransactionService,
    private router: Router,
    private ToastService: ToastService,
    private systemDataService: SystemDataService,
    private financialService: FinancialReportService,
  ) { }

  ngOnInit() {

    
    this.systemDataService.get_configuration().pipe(
      map((conf) => {
        this.current_season = conf.season;
        let today = new Date();
        let season_last_date = this.systemDataService.last_date(conf.season);
        if (new Date(season_last_date) < today) {
          this.bank_reports = this.systemDataService.get_season_months(new Date(season_last_date));
        }
        else {
          this.bank_reports = this.systemDataService.get_season_months(today);
        }
        return conf.season;
      }),
      switchMap((season) => combineLatest([
        this.financialService.read_balance_sheet(this.systemDataService.previous_season(season)),
        this.bookService.list_book_entries$(season)
      ])))
      .subscribe(([former_balance_sheet, book_entries]) => {
        this.former_balance_sheet = former_balance_sheet;
        this.bank_book_entries = book_entries
        .filter(book_entry => this.bank_accounts.some(op => book_entry.amounts[op] !== undefined))
        .sort((a, b) => {
          return a.date.localeCompare(b.date) === 0 ? (a.updatedAt ?? '').localeCompare(b.updatedAt ?? '') : a.date.localeCompare(b.date);
        });;
      });
  }


  // utilities

  previous_season(season: string): string {
    return this.systemDataService.previous_season(season);
  }

  transaction_label(book_entry: BookEntry): string {
    let transaction = this.transactionService.get_transaction(book_entry.transaction_id);
    return transaction.label + (book_entry.cheque_ref ? ' - ' + book_entry.cheque_ref : '');
  }

  book_label(book_entry: BookEntry): string {
    let transaction = this.transactionService.get_transaction(book_entry.transaction_id);
    if (transaction.require_deposit_ref) {
      return book_entry.deposit_ref!;
    } else {
      return (book_entry.operations? book_entry.operations[0].label : '');
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

  movement_out(report: string | null): { bank: number, savings: number } {
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
      , { bank: this.former_balance_sheet.bank, savings: this.former_balance_sheet.savings });
  }


}
