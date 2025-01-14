import { Component } from '@angular/core';
import { Expense, Financial, FINANCIALS, RECORD_CLASS, Revenue } from '../../../../../common/new_sales.interface';
import { BookService } from '../../book.service';
import { CommonModule } from '@angular/common';
import { Member } from '../../../../../common/member.interface';
import { MembersService } from '../../../../../admin-dashboard/src/app/members/service/members.service';
import { Product } from '../../../../../admin-dashboard/src/app/sales/products/product.interface';
import { ProductService } from '../../../../../common/services/product.service';
import { FormsModule } from '@angular/forms';
import { SystemDataService } from '../../../../../common/services/system-data.service';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { BookingEditComponent } from '../../booking-edit/booking-edit.component';
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

  financials: Financial[] = [];
  bank_financials: Financial[] = [];
  cash_financials: Financial[] = [];
  asset_financials: Financial[] = [];
  debt_financials: Financial[] = [];
  current_cash_amount: number = 0;
  current_assets_amount: number = 0;
  current_debt_amount: number = 0;


  financial_ops = Object.values(FINANCIALS);
  bank_ops = this.financial_ops.filter(op => !op.includes('cash') && !op.includes('avoir') && !op.includes('creance'));
  cash_ops = this.financial_ops.filter(op => op.includes('cash'));
  asset_ops = this.financial_ops.filter(op => op.includes('avoir'));
  debt_ops = this.financial_ops.filter(op => op.includes('creance'));

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


    this.bookService.list_financials$().subscribe((financials) => {
      this.financials = financials;
      this.build_arrays();

      this.current_cash_amount = this.cash_financials.reduce((acc, financial) => {
        return acc + (financial.amounts['cash_in'] || 0) - (financial.amounts['cash_out'] || 0);
      }, 0);

      this.current_assets_amount = this.asset_financials.reduce((acc, financial) => {
        return acc + (financial.amounts['avoir_in'] || 0) - (financial.amounts['avoir_out'] || 0);
      }, 0);

      this.current_debt_amount = this.debt_financials.reduce((acc, financial) => {
        return acc + (financial.amounts['creance_in'] || 0) - (financial.amounts['creance_out'] || 0);
      }, 0);

    });

  }



  build_arrays() {
    this.bank_financials = this.financials.filter(financial => this.bank_ops.some(op => financial.amounts[op] !== undefined));
    this.cash_financials = this.financials.filter(financial => this.cash_ops.some(op => financial.amounts[op] !== undefined));
    this.asset_financials = this.financials.filter(financial => this.asset_ops.some(op => financial.amounts[op] !== undefined));
    console.log('this.asset_financials', this.asset_financials);
    this.debt_financials = this.financials.filter(financial => this.debt_ops.some(op => financial.amounts[op] !== undefined));
    this.revenues = this.bookService.get_revenues();
    this.expenses = this.bookService.get_expenses();

  }


  delete_financial(financial: Financial) {
    this.bookService.delete_financial(financial.id!).then((financial) => {
    });
  }

  show_financial(financial_id: string) {
    this.router.navigate(['/books/booking', financial_id]);
  }

}