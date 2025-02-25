import { Component, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Bank_accounts, BookEntry, ENTRY_TYPE, FINANCIAL_ACCOUNT } from '../../../../common/accounting.interface';
import { SystemDataService } from '../../../../common/services/system-data.service';
import { BookService } from '../book.service';
import { get_transaction } from '../../../../common/transaction.definition';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { Router } from '@angular/router';

@Component({
  selector: 'app-bank-reconciliation',
  standalone: true,
  encapsulation: ViewEncapsulation.None,   // nécessaire pour que les tooltips fonctionnent
  imports: [CommonModule, FormsModule, NgbTooltipModule],
  templateUrl: './bank-reconciliation.component.html',
  styleUrl: './bank-reconciliation.component.scss'
})
export class BankReconciliationComponent {


  bank_book_entries: BookEntry[] = [];
  bank_accounts = Object.values(Bank_accounts) as FINANCIAL_ACCOUNT[];


  constructor(
    private bookService: BookService,
    private router: Router,
    private systemDataService: SystemDataService,
  ) { }

  ngOnInit() {


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
    return (book_entry.operations[0]?.label ?? '');
  }
  show_book_entry(book_entry_id: string) {
    this.router.navigate(['/books/editor', book_entry_id]);
  }

}
