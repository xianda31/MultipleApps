import { Component, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Bank_accounts, BookEntry, ENTRY_TYPE, FINANCIAL_ACCOUNT } from '../../../../common/accounting.interface';
import { SystemDataService } from '../../../../common/services/system-data.service';
import { BookService } from '../book.service';
import { get_transaction } from '../../../../common/transaction.definition';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { Router } from '@angular/router';
import { ToastService } from '../../../../common/toaster/toast.service';

@Component({
  selector: 'app-bank-reconciliation',
  standalone: true,
  encapsulation: ViewEncapsulation.None,   // nécessaire pour que les tooltips fonctionnent
  imports: [CommonModule, FormsModule, NgbModule],
  templateUrl: './bank-reconciliation.component.html',
  styleUrl: './bank-reconciliation.component.scss'
})
export class BankReconciliationComponent {


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
    this.bookService.list_book_entries$().subscribe((book_entries) => {
      this.bank_book_entries = book_entries.filter(book_entry => this.bank_accounts.some(op => book_entry.amounts[op] !== undefined));
      console.log(this.bank_book_entries);
    });

  }


  // utilities

  transaction_label(op_type: ENTRY_TYPE): string {
    return get_transaction(op_type).
      label;
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
    if (report && report <= date) {
      this.ToastService.showWarningToast('pointage annulé', 'le relevé ne peut être antérieur à l\'opération');
      book_entry.bank_report = null;
    }

    this.bookService.update_book_entry(book_entry);
  }

  // possible_bank_reports(): string[] {
  //   return this.bank_reports;
  // }

}
