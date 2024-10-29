import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MembersService } from '../../../../../admin-dashboard/src/app/members/service/members.service';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { combineLatest, map, Observable, of, switchMap, tap } from 'rxjs';
import { SystemDataService } from '../../../../../common/services/system-data.service';
import { Bank } from '../../../../../common/system-conf.interface';
import { ExcelService } from '../../excel.service';
import { SalesService } from '../../shop/sales.service';
import { Sale, PaymentMode } from '../../shop/sales.interface';
import { ProductService } from '../../../../../common/services/product.service';
import { SalesViewerComponent } from "../sales-viewer/sales-viewer.component";



@Component({
  selector: 'app-sales',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, SalesViewerComponent],
  templateUrl: './sales.component.html',
  styleUrl: './sales.component.scss'
})
export class SalesComponent {
  sales_subscription: any;
  season_subscription: any;
  products_subscription: any;
  payment_mode = PaymentMode;
  season: string = '';
  banks !: Bank[];
  season$: Observable<string> = of(this.season);
  loaded = false;
  // payment_accounts: string[] = [];
  // payMode = PaymentMode;
  // sales$!: Observable<Sale[]>;
  sales: Sale[] = [];

  constructor(
    private membersService: MembersService,
    private systemDataService: SystemDataService,
    private salesService: SalesService,
    private productService: ProductService,
    private excelService: ExcelService
  ) {

    // this.sales$ = this.systemDataService.configuration$.pipe(
    //   tap((conf) => {
    //     this.season = conf.season;
    //     this.banks = conf.banks;
    //   }),
    //   switchMap((conf) => {
    //     return this.list_sales(conf.season);
    //   })
    // );


    // this.payment_accounts = Object.entries(this.payMode).map(([key, value]) => value);


  }


  ngDestroy() {
    this.season_subscription.unsubscribe();
  }


  ngOnInit(): void {
    combineLatest([this.systemDataService.configuration$, this.productService.listProducts()])
      .subscribe(([conf, products]) => {
        // this.products = products;
        this.season = conf.season;
        this.banks = conf.banks;
        this.list_sales(this.season).subscribe((sales) => {
          this.sales = sales;
          console.log('sales', this.sales);
          this.loaded = true;
        });
      });
  }


  list_sales(season: string): Observable<Sale[]> {
    return this.salesService.get_sales(season).pipe(
      map((sales) => {
        // if (!sales) return [];
        return sales.sort((a, b) => a.event > b.event ? 1 : -1)
        // console.log('sales', this.sales);
      })
    );
  }

  new_season(event: any) {
    this.sales_subscription.unsubscribe();
    let season = event.target.value;
    this.list_sales(season);
  }





  // color_swapper(i: number) {
  //   return i % 2 === 0 ? 'table-light' : 'table-primary';
  // }

  export_excel() {
    let data: any[] = [];
    // this.sales.forEach((sale) => {
    //   data.push({
    //     date: this.format_date(sale.event),
    //     montant: 666,
    //     bénéficiaire: this.member_name(sale.payer_id),
    //     // sale_mode: sale.revenues[0].mode,
    //   });
    // });
    // this.excelService.generateExcel(data, 'revenues');
  }
}

