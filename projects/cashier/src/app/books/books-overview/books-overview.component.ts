import { Component } from '@angular/core';
import { Expense, EXPENSES_ACCOUNTS, Financial, FINANCIALS, OPERATION_CLASS, PRODUCTS_ACCOUNTS, Revenue } from '../../../../../common/new_sales.interface';
import { BookService } from '../../book.service';
import { CommonModule } from '@angular/common';
import { EXPENSES_COL, PRODUCTS_COL } from '../../../../../common/excel/excel.interface';
import { Member } from '../../../../../common/member.interface';
import { MembersService } from '../../../../../admin-dashboard/src/app/members/service/members.service';
import { Product } from '../../../../../admin-dashboard/src/app/sales/products/product.interface';
import { ProductService } from '../../../../../common/services/product.service';
import { FormsModule } from '@angular/forms';


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


  //

  revenues!: Revenue[];
  expenses: Expense[] = [];

  financials: Financial[] = [];
  bank_financials: Financial[] = [];
  cash_financials: Financial[] = [];
  current_cash_amount: number = 0;

  products_accounts = Object.entries(PRODUCTS_COL).map(([account, col]) => account as PRODUCTS_ACCOUNTS);
  expenses_accounts = Object.entries(EXPENSES_COL).map(([account, col]) => account as EXPENSES_ACCOUNTS);


  financial_ops = Object.values(FINANCIALS);
  bank_ops = this.financial_ops.filter(op => !op.includes('cash') && !op.includes('avoir'));
  cash_ops = this.financial_ops.filter(op => op.includes('cash'));

  constructor(
    private bookService: BookService,
    private membersService: MembersService,
    private productsService: ProductService,


  ) {
  }

  async ngOnInit() {
    this.membersService.listMembers().subscribe((members) => {
      this.members = members;
    });

    this.productsService.listProducts().subscribe((products) => {
      this.products = products;
    });


    this.bookService.list_financials$().subscribe((financials) => {
      this.financials = financials;
      this.build_arrays();

      this.current_cash_amount = this.cash_financials.reduce((acc, financial) => {
        return acc + (financial.amounts['cash_in'] || 0) - (financial.amounts['cash_out'] || 0);
      }, 0);
    });

  }

  build_arrays() {
    this.bank_financials = this.financials.filter(financial => this.bank_ops.some(op => financial.amounts[op] !== undefined));
    this.cash_financials = this.financials.filter(financial => this.cash_ops.some(op => financial.amounts[op] !== undefined));

    this.revenues = this.bookService.get_revenues_from_members();

    this.expenses = this.financials.reduce((acc, financial) => {
      const expenses = financial.operations
        .filter(op => op.class === OPERATION_CLASS.EXPENSE)
        .map(op => ({
          ...op,
          season: financial.season,
          date: financial.date
        } as Expense));
      return [...acc, ...expenses];
    }, [] as Expense[]);

  }


  data_store() { }





  //

  delete_financial(financial: Financial) {
    this.bookService.delete_financial(financial.id!).then((financial) => {
    });
  }


}



