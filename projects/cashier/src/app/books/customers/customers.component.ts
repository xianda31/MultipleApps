import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MembersService } from '../../../../../admin-dashboard/src/app/members/service/members.service';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { combineLatest, from, map, Observable, of, tap } from 'rxjs';
import { SystemDataService } from '../../../../../common/services/system-data.service';
import { Bank } from '../../../../../common/system-conf.interface';
import { ExcelService } from '../../excel.service';
import { SalesService } from '../../shop/sales.service';
import { Sale, PaymentMode, SaleItem } from '../../shop/sales.interface';
import { Member } from '../../../../../common/member.interface';
import { ProductService } from '../../../../../common/services/product.service';
import { Product } from '../../../../../admin-dashboard/src/app/sales/products/product.interface';



@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './customers.component.html',
  styleUrl: './customers.component.scss'
})
export class CustomersComponent {
  saleItems: SaleItem[] = [];
  saleItems_subscription: any;
  season_subscription: any;
  products_subscription: any;
  payment_mode = PaymentMode;
  season$!: Observable<string>;
  loaded = false;
  members: Member[] = [];
  products: Product[] = [];
  data_list: { [m: string]: { [c: string]: number } } = {};
  data_sums: { [c: string]: number } = {};
  product_keys: string[] = [];
  credit_accounts: string[] = [];

  constructor(
    private membersService: MembersService,
    private systemDataService: SystemDataService,
    private salesService: SalesService,
    private productService: ProductService,
    private excelService: ExcelService,
  ) {
    this.season$ = this.systemDataService.configuration$.pipe(
      tap((conf) => this.credit_accounts = conf.product_accounts.map((account) => account.key)),
      map((conf) => conf.season))
  }


  ngDestroy() {
    this.season_subscription.unsubscribe();
  }


  ngOnInit(): void {

    combineLatest([this.season$, this.membersService.listMembers(), this.productService.listProducts()])
      .subscribe(([season, members, products]) => {
        this.members = members;
        this.products = products;
        this.product_keys = Object.keys(this.productService.products_array(products));
        this.list_saleItems(season);
      });
  }


  list_saleItems(season: string) {
    this.saleItems_subscription = this.salesService.getSaleItems(season)
      .subscribe((saleItems) => {
        this.saleItems = saleItems;
        this.data_list = this.format_data_list();
        this.data_sums = this.compute_sums(this.data_list);
      });
  }



  new_season(event: any) {
    this.saleItems_subscription.unsubscribe();
    let season = event.target.value;
    this.list_saleItems(season);
  }

  member_name(member_id: string): string {
    const member = this.members.find((m) => m.id === member_id);
    return member ? member.lastname.toUpperCase() + ' ' + member.firstname : 'inconnu ???';
  }

  product_name(product_id: string): string {
    const product = this.products.find((p) => p.id === product_id);
    return product ? product.account : 'inconnu';
  }

  format_date(date: string): string {
    const formated_date = new Date(date);
    return formated_date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  }


  export_excel() {
    let data: any[] = [];
    let headers = ['adhérent', ...this.credit_accounts];
    Object.entries(this.data_list).forEach(([key, entry]) => {
      data.push({
        'adhérent': key,
        ...entry,
      });

    });
    this.excelService.generateExcel_withHeader(headers, data, 'recettes');
  }

  // utilities for data formatting and sum computation

  format_data_list(): { [m: string]: { [c: string]: number } } {
    const data: { [m: string]: { [c: string]: number } } = {};
    this.data_sums = {};
    this.saleItems.forEach((saleItem) => {
      const name = this.member_name(saleItem.payee_id);
      const product = this.product_name(saleItem.product_id);
      if (data[name]) {
        if (data[name][product]) {
          data[name][product] += saleItem.paied;
        } else {
          data[name][product] = saleItem.paied;
        }
      } else {
        data[name] = { [product]: saleItem.paied };
      }
    });

    // compute member sums
    Object.entries(data).forEach(([name, entry]) => {
      Object.entries(entry).forEach(([key, amount]) => {
        if (data[name]['total']) {
          data[name]['total'] += amount;
        } else {
          data[name]['total'] = amount;
        }
      });

    });
    return data;
  }

  compute_sums(data_list: { [m: string]: { [c: string]: number } }): { [c: string]: number } {
    const sums: { [c: string]: number } = {};
    Object.entries(data_list).forEach(([key, entry]) => {
      Object.entries(entry).forEach(([product, amount]) => {
        if (sums[product]) {
          sums[product] += amount;
        } else {
          sums[product] = amount;
        }
      });
    });
    return sums
  }


}
