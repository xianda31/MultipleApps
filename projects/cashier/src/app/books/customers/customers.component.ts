import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MembersService } from '../../../../../admin-dashboard/src/app/members/service/members.service';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { from, map, Observable, of, tap } from 'rxjs';
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

  constructor(
    private membersService: MembersService,
    private systemDataService: SystemDataService,
    private salesService: SalesService,
    private productService: ProductService,
    private excelService: ExcelService,
  ) {
    this.season$ = this.systemDataService.configuration$.pipe(
      map((conf) => conf.season));
  }


  ngDestroy() {
    this.season_subscription.unsubscribe();
  }


  ngOnInit(): void {
    this.season_subscription = this.season$.subscribe((season) => {
      this.list_saleItems(season);
    });
    this.membersService.listMembers().subscribe((members) => {
      this.members = members;
      this.loaded = true;
    });

    this.products_subscription = this.productService.listProducts()
      .subscribe((products) => {
        this.products = products;
      });
  }



  list_saleItems(season: string) {
    this.saleItems_subscription = this.salesService.getSaleItems(season)
      .subscribe((saleItems) => {
        this.saleItems = saleItems;
        console.log('saleItems', this.saleItems);
      });
  }

  new_season(event: any) {
    this.saleItems_subscription.unsubscribe();
    let season = event.target.value;
    this.list_saleItems(season);
  }

  member_name(member_id: string): string {
    const member = this.members.find((m) => m.id === member_id);
    return member ? member.firstname + ' ' + member.lastname : 'inconnu';
  }

  product_name(product_id: string): string {
    const product = this.products.find((p) => p.id === product_id);
    return product ? product.description : 'inconnu';
  }

  format_date(date: string): string {
    const formated_date = new Date(date);
    return formated_date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  }


  export_excel() {
    let data: any[] = [];
    this.saleItems.forEach((saleItem) => {
      data.push({
        // date: this.format_date(saleItem.event),
        // montant: saleItem.amount,
        // bénéficiaire: this.member_name(saleItem.payer_id),
        // saleItem_mode: saleItem.revenues[0].mode,
      });
    });
    this.excelService.generateExcel(data, 'ventes');
  }
}
