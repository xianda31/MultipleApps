import { Component } from '@angular/core';
import { Expense, BookEntry, FINANCIAL_ACCOUNT, Revenue, ENTRY_TYPE, Cashbox_accounts, Bank_accounts } from '../../../../../common/accounting.interface';
import { BookService } from '../../book.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SystemDataService } from '../../../../../common/services/system-data.service';
import { Router } from '@angular/router';
import { get_transaction } from '../../../../../common/transaction.definition';


@Component({
  selector: 'app-books-overview',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './books-overview.component.html',
  styleUrl: './books-overview.component.scss'
})
export class BooksOverviewComponent {

  expenses_accounts !: string[];
  products_accounts !: string[];

  revenues!: Revenue[];
  expenses: Expense[] = [];

  book_entries: BookEntry[] = [];
  cashbox_book_entries: BookEntry[] = [];
  bank_book_entries: BookEntry[] = [];

  current_cash_amount: number = 0;
  current_assets_amount: number = 0;
  current_debt_amount: number = 0;


  bank_accounts = Object.values(Bank_accounts) as FINANCIAL_ACCOUNT[];
  cashbox_accounts = Object.values(Cashbox_accounts) as FINANCIAL_ACCOUNT[];

  debts: Map<string, number> = new Map();
  assets: Map<string, number> = new Map();

  constructor(
    private bookService: BookService,
    private systemDataService: SystemDataService,
    private router: Router,
  ) { }

  ngOnInit() {

    this.systemDataService.configuration$.subscribe((conf) => {
      this.expenses_accounts = conf.charge_accounts.map((account) => account.key);
      this.products_accounts = conf.product_accounts.map((account) => account.key);
    });


    this.bookService.list_book_entries$().subscribe((book_entries) => {
      this.book_entries = book_entries;
      this.build_arrays();

      this.current_cash_amount = this.bookService.get_cashbox_amount();
      this.debts = this.bookService.get_debts();
      this.assets = this.bookService.get_assets();

      this.current_debt_amount = this.debts.size > 0 ? Array.from(this.debts.values()).reduce((acc, debt) => acc + debt, 0) : 0;
      this.current_assets_amount = this.assets.size > 0 ? Array.from(this.assets.values()).reduce((acc, asset) => acc + asset, 0) : 0;

    });

  }

  // utilities

  transaction_label(op_type: ENTRY_TYPE): string {
    return get_transaction(op_type).label;
  }


  build_arrays() {
    this.bank_book_entries = this.book_entries.filter(book_entry => this.bank_accounts.some(op => book_entry.amounts[op] !== undefined));
    this.cashbox_book_entries = this.book_entries.filter(book_entry => this.cashbox_accounts.some(op => book_entry.amounts[op] !== undefined));;
    this.revenues = this.bookService.get_revenues();
    this.expenses = this.bookService.get_expenses();
  }


  delete_book_entry(book_entry: BookEntry) {
    this.bookService.delete_book_entry(book_entry.id!).then((book_entry) => {
    });
  }

  show_book_entry(book_entry_id: string) {
    this.router.navigate(['/books/editor', book_entry_id]);
  }

}