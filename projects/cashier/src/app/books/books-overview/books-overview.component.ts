import { Component } from '@angular/core';
import { Expense, Bookentry, FINANCIAL_ACCOUNTS, Revenue } from '../../../../../common/accounting.interface';
import { BookService } from '../../book.service';
import { CommonModule } from '@angular/common';
import { Member } from '../../../../../common/member.interface';
import { MembersService } from '../../../../../admin-dashboard/src/app/members/service/members.service';
import { Product } from '../../../../../admin-dashboard/src/app/sales/products/product.interface';
import { ProductService } from '../../../../../common/services/product.service';
import { FormsModule } from '@angular/forms';
import { SystemDataService } from '../../../../../common/services/system-data.service';
import { Router } from '@angular/router';


@Component({
  selector: 'app-books-overview',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './books-overview.component.html',
  styleUrl: './books-overview.component.scss'
})
export class BooksOverviewComponent {
  products: Product[] = [];

  members: Member[] = [];
  season: string = '2024/2025';
  expenses_accounts !: string[]; //= Object.values(EXPENSES_ACCOUNTS);
  products_accounts !: string[]; //= Object.values(PRODUCTS_ACCOUNTS);

  //

  revenues!: Revenue[];
  expenses: Expense[] = [];

  book_entries: Bookentry[] = [];
  cash_book_entries: Bookentry[] = [];
  bank_book_entries: Bookentry[] = [];
  asset_book_entries: Bookentry[] = [];
  debt_book_entries: Bookentry[] = [];
  current_cash_amount: number = 0;
  current_assets_amount: number = 0;
  current_debt_amount: number = 0;


  book_entry_ops = Object.values(FINANCIAL_ACCOUNTS);
  bank_ops = this.book_entry_ops.filter(op => !op.includes('cash') && !op.includes('avoir') && !op.includes('creance'));
  cash_ops = this.book_entry_ops.filter(op => op.includes('cash'));
  asset_ops = this.book_entry_ops.filter(op => op.includes('avoir'));
  debt_ops = this.book_entry_ops.filter(op => op.includes('creance'));

  constructor(
    private bookService: BookService,
    private membersService: MembersService,
    private systemDataService: SystemDataService,
    private router: Router,
    private productsService: ProductService,
  ) {

  }

  ngOnInit() {

    this.systemDataService.configuration$.subscribe((conf) => {
      this.expenses_accounts = conf.charge_accounts.map((account) => account.key);
      this.products_accounts = conf.product_accounts.map((account) => account.key);
    });

    this.membersService.listMembers().subscribe((members) => {
      this.members = members;
    });

    this.productsService.listProducts().subscribe((products) => {
      this.products = products;
    });


    this.bookService.list_book_entries$().subscribe((book_entries) => {
      this.book_entries = book_entries;
      this.build_arrays();

      this.current_cash_amount = this.cash_book_entries.reduce((acc, book_entry) => {
        return acc + (book_entry.amounts['cash_in'] || 0) - (book_entry.amounts['cash_out'] || 0);
      }, 0);

      this.current_assets_amount = this.asset_book_entries.reduce((acc, book_entry) => {
        return acc + (book_entry.amounts['avoir_in'] || 0) - (book_entry.amounts['avoir_out'] || 0);
      }, 0);

      this.current_debt_amount = this.debt_book_entries.reduce((acc, book_entry) => {
        return acc + (book_entry.amounts['creance_in'] || 0) - (book_entry.amounts['creance_out'] || 0);
      }, 0);

    });

  }



  build_arrays() {
    this.bank_book_entries = this.book_entries.filter(book_entry => this.bank_ops.some(op => book_entry.amounts[op] !== undefined));
    this.cash_book_entries = this.book_entries.filter(book_entry => this.cash_ops.some(op => book_entry.amounts[op] !== undefined));
    this.asset_book_entries = this.book_entries.filter(book_entry => this.asset_ops.some(op => book_entry.amounts[op] !== undefined));
    this.debt_book_entries = this.book_entries.filter(book_entry => this.debt_ops.some(op => book_entry.amounts[op] !== undefined));
    this.revenues = this.bookService.get_revenues();
    this.expenses = this.bookService.get_expenses();

  }


  delete_book_entry(book_entry: Bookentry) {
    this.bookService.delete_book_entry(book_entry.id!).then((book_entry) => {
    });
  }

  show_book_entry(book_entry_id: string) {
    this.router.navigate(['/books/editor', book_entry_id]);
  }

}