import { Component } from '@angular/core';
import { combineLatest, map, Observable, tap } from 'rxjs';
import { SystemDataService } from '../../../../common/services/system-data.service';
import { ExcelService } from '../excel.service';
import { SalesService } from '../shop/sales.service';
import { PaymentMode, Revenue } from '../shop/sales.interface';
import { CommonModule } from '@angular/common';
import { data } from '../../../../../amplify/data/resource';

@Component({
  selector: 'app-revenues',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './revenues.component.html',
  styleUrl: './revenues.component.scss'
})
export class RevenuesComponent {
  season$!: Observable<string>;
  revenues: Revenue[] = [];
  revenues_subscription: any;
  payMode = PaymentMode;
  data_list: { [m: string]: { [c: string]: number } } = {};
  credit_accounts: string[] = [];

  constructor(
    private systemDataService: SystemDataService,
    private excelService: ExcelService,
    private saleService: SalesService,
  ) {
    this.systemDataService.configuration$.pipe(
      map((conf) => conf.season)).subscribe((season) => {
        this.list_revenues(season);
      }
      );


    this.credit_accounts = Object.entries(this.payMode).map(([key, value]) => value);
  }

  list_revenues(season: string) {
    this.revenues_subscription = this.saleService.getRevenues(season).subscribe((revenues) => {
      this.revenues = revenues;
      console.log('revenues', revenues);
      this.data_list = this.format_data_list();
    });
  }

  format_data_list(): { [m: string]: { [c: string]: number } } {

    const data_list: { [m: string]: { [c: string]: number } } = {};
    this.revenues.forEach((revenue) => {
      if (!data_list[revenue.sale_id]) {
        data_list[revenue.sale_id] = { [revenue.mode]: revenue.amount };
      }
      data_list[revenue.sale_id][revenue.mode] = revenue.amount;
    });
    return data_list;
  }

  new_season(event: any) {
    this.revenues_subscription.unsubscribe();
    let season = event.target.value;
    this.list_revenues(season);
  }


  export_excel() {
    // let data: any[] = [];
    // let headers = ['adhérent', ...this.credit_accounts];
    // Object.entries(this.data_list).forEach(([key, entry]) => {
    //   data.push({
    //     'adhérent': key,
    //     ...entry,
    //   });

    // });
    // this.excelService.generateExcel_withHeader(headers, data, 'recettes');
  }
}
