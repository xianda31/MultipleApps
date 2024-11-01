import { Component, Input } from '@angular/core';
import { PaymentMode, Sale } from '../../cashier/src/app/shop/sales.interface';
import { MembersService } from '../../admin-dashboard/src/app/members/service/members.service';
import { ProductService } from '../services/product.service';
import { SystemDataService } from '../services/system-data.service';
import { ExcelService } from '../../cashier/src/app/excel.service';
import { SalesService } from '../../cashier/src/app/shop/sales.service';
import { Bank } from '../system-conf.interface';
import { Observable, of, tap, map } from 'rxjs';
import { Product } from '../../admin-dashboard/src/app/sales/products/product.interface';
import { CommonModule } from '@angular/common';

interface f_products { [payee: string]: { [product_key: string]: number } }
interface f_payments { [payment_key: string]: number }
interface f_Sale {
  event: string;
  payees_nbr: number;
  payments: f_payments;
  products: f_products;
}

@Component({
  selector: 'app-sales-viewer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sales-viewer.component.html',
  styleUrl: './sales-viewer.component.scss'
})
export class SalesViewerComponent {
  @Input() sales!: Sale[];

  f_sales: f_Sale[] = [];
  season: string = '';
  banks !: Bank[];
  season$: Observable<string> = of(this.season);
  products: Product[] = [];
  product_accounts: string[] = [];
  payment_accounts: string[] = [];
  payMode = PaymentMode;
  loaded = false;


  constructor(
    private membersService: MembersService,
    private systemDataService: SystemDataService,
    private productService: ProductService,
  ) {
    this.season$ = this.systemDataService.configuration$.pipe(
      tap((conf) => {
        this.season = conf.season;
        this.banks = conf.banks;
        this.product_accounts = conf.product_accounts.map((account) => account.key);
      }),
      map((conf) => conf.season),
    );

    this.payment_accounts = Object.entries(this.payMode).map(([key, value]) => value);
  }

  ngOnInit(): void {


    this.systemDataService.configuration$.subscribe((conf) => {
      this.season = conf.season;
      this.banks = conf.banks;
      this.product_accounts = conf.product_accounts.map((account) => account.key);
    });

    this.productService.listProducts().subscribe((products) => {
      this.products = products;
      this.f_sales = this.format_sales(this.sales);
      // console.log('f_sales', this.f_sales);
      this.loaded = true;
    });
  }

  format_sales(sales: Sale[]): f_Sale[] {
    const f_sales: f_Sale[] = [];
    // formatage données payee_produits
    sales.forEach((sale) => {
      const event = sale.event;
      const products: f_products = {};
      const payments: f_payments = {};
      sale.records?.forEach((record) => {
        if (record.class.includes('Product')) {
          const payee = this.member_name(record.member_id!);
          // console.log('record', record);
          const product = this.products.find((product) => product.id === record.product_id);
          if (!product) {
            // console.log('ref. missing', record);
            return;
          }
          const product_key = product.account;
          const amount = record.amount;
          if (!products[payee]) {
            products[payee] = { [product_key]: amount };
          } else {
            if (!products[payee][product_key]) {
              products[payee][product_key] = amount;
            } else {
              products[payee][product_key] += amount;
            }
          }
        } else if (record.class.includes('Payment')) {
          const payment_key = record.mode!;
          const amount = record.amount;
          if (!payments[payment_key]) {
            payments[payment_key] = amount;
          } else {
            payments[payment_key] += amount;
          }
        }
      });
      const payees_nbr = Object.keys(products).length;
      f_sales.push({ event, payees_nbr, products, payments });
    });

    // console.log('f_sales', f_sales);
    return f_sales;
  }

  member_name(member_id: string) {
    let member = this.membersService.getMember(member_id);
    return member ? member.lastname.toLocaleUpperCase() + ' ' + member.firstname : '???';
  }

  bank_name(bank_key: string) {
    let bank = this.banks.find((bank) => bank.key === bank_key);
    return bank ? bank.name : '???';
  }

  format_date(date: string): string {
    const formated_date = new Date(date);
    // return formatDate(date, 'EEEE d MMMM HH:00', 'fr-FR');
    return formated_date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  // format_vendor(vendor: string): string {
  //   const gliph = vendor.toLocaleUpperCase().split(' ').map((word) => word[0]).join('');
  //   return gliph;
  // }

  sale_amount(sale: Sale) {
    if (!sale.records) {
      return 0;
    }
    return sale.records
      .filter((record) => record.class.includes('Product'))
      .reduce((total, record) => total + record.amount, 0);
  }
}
