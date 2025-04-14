import { Component } from '@angular/core';
import { Expense, BookEntry, FINANCIAL_ACCOUNT, Revenue, ENTRY_TYPE, Cashbox_accounts, Bank_accounts, Liquidities } from '../../../../../common/accounting.interface';
import { BookService } from '../../book.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SystemDataService } from '../../../../../common/services/system-data.service';
import { Router } from '@angular/router';
import { TransactionService } from '../../transaction.service';

interface EntryValue { total: number, entries: BookEntry[] };
@Component({
  selector: 'app-books-overview',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './books-overview.component.html',
  styleUrl: './books-overview.component.scss'
})
export class BooksOverviewComponent {
  truncature = '1.2-2';  // '1.0-0';// '1.2-2';  //


  expenses_accounts !: string[];
  products_accounts !: string[];

  revenues!: Revenue[];
  expenses: Expense[] = [];

  book_entries: BookEntry[] = [];
  cashbox_book_entries: BookEntry[] = [];
  bank_book_entries: BookEntry[] = [];

  current_cash_movements: number = 0;
  current_bank_movements: number = 0;
  current_assets_amount: number = 0;
  current_debt_amount: number = 0;
  current_expenses_operations_amount: number = 0;

  initial_liquidities: Liquidities = { cash: 0, bank: 0, savings: 0 };

  bank_accounts = Object.values(Bank_accounts) as FINANCIAL_ACCOUNT[];
  cashbox_accounts = Object.values(Cashbox_accounts) as FINANCIAL_ACCOUNT[];

  debts: Map<string, number> = new Map();
  assets: Map<string, EntryValue> = new Map();
  assets_entries: { [key: string]: EntryValue } = {};

  constructor(
    private bookService: BookService,
    private transactionService: TransactionService,
    private systemDataService: SystemDataService,
    private router: Router,
  ) { }

  ngOnInit() {

    this.systemDataService.get_configuration().subscribe((conf) => {
      this.expenses_accounts = conf.financial_tree.expenses.map((account) => account.key);
      this.products_accounts = conf.financial_tree.revenues.map((account) => account.key);

      this.systemDataService.get_balance_sheet_initial_amounts(conf.season).subscribe((liquidities) => {
        this.initial_liquidities = liquidities;
      });

      this.bookService.list_book_entries$(conf.season).subscribe((book_entries) => {
        this.book_entries = book_entries;
        this.build_arrays();

        this.current_cash_movements = this.bookService.get_cashbox_movements_amount();
        this.current_bank_movements = this.bookService.get_bank_movements_amount();
        this.debts = this.bookService.get_debts();
        this.assets = this.bookService.get_customers_assets();
        this.assets_entries = Object.fromEntries(this.assets.entries());

        this.current_debt_amount = this.debts.size > 0 ? Array.from(this.debts.values()).reduce((acc, debt) => acc + debt, 0) : 0;
        this.current_assets_amount = this.assets.size > 0 ? Array.from(this.assets.values()).reduce((acc, asset) => acc + asset.total, 0) : 0;

        this.current_expenses_operations_amount = this.bookService.get_expenses_movements_amount();

      });
    });

  }

  // utilities

  transaction_label(op_type: ENTRY_TYPE): string {
    return this.transactionService.get_transaction(op_type).label;
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

  show(selection: string) {
    let id = selection.split(' : ')[1];
    console.log(id);
    this.router.navigate(['/books/editor', id]);
  }

}
