import { Component } from '@angular/core';
import { combineLatest, map, Observable, tap } from 'rxjs';
import { SystemDataService } from '../../../../common/services/system-data.service';
import { ExcelService } from '../excel.service';
import { SalesService } from '../shop/sales.service';
import { PaymentMode, Record } from '../shop/sales.interface';
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
  // revenues: Revenue[] = [];
  records_subscription: any;
  payMode = PaymentMode;
  data_list: { [m: string]: { [c: string]: number } } = {};
  debit_accounts: string[] = [];


  constructor(
    private systemDataService: SystemDataService,
    private excelService: ExcelService,
    private saleService: SalesService,
  ) {

    this.season$ = this.systemDataService.configuration$.pipe(
      map((conf) => conf.season))

    this.season$.subscribe((season) => {
      this.list_records(season);
    }
    );

    this.debit_accounts = Object.entries(this.payMode).map(([key, value]) => value);
    // console.log('this.debit_accounts', this.debit_accounts);
  }

  list_records(season: string) {
    this.records_subscription = this.saleService.read_records$(season).subscribe((records) => {
      console.log('records', records);
      const payments = records.filter((record) => record.class.includes('debit'));
      this.data_list = this.format_data_list(payments);
    });
  }

  format_data_list(payments: Record[]): { [m: string]: { [c: string]: number } } {

    const data_list: { [m: string]: { [c: string]: number } } = {};
    payments.forEach((payment) => {
      const sale = this.saleService.read_sale(payment.sale_id);
      const date = sale ? (sale.date) : 'inconnu';
      const payment_mode = payment.mode as string;
      if (!data_list[date]) {
        data_list[date] = { [payment_mode]: payment.amount };
      } else {
        if (!data_list[date][payment_mode]) {
          data_list[date][payment_mode] = payment.amount;
        } else {
          data_list[date][payment_mode] += payment.amount;
        }
      }
    });
    return data_list;
  }

  new_season(date: any) {
    this.records_subscription.unsubscribe();
    let season = date.target.value;
    // this.list_records(season);
  }

  // vendor_glyph(vendor: string) {
  //   const words = vendor.split(' ');
  //   return words[0] + ' ' + words[1][0] + '.';
  // }

  export_excel() {
    // let data: any[] = [];
    // let headers = ['adhérent', ...this.debit_accounts];
    // Object.entries(this.data_list).forEach(([key, entry]) => {
    //   data.push({
    //     'adhérent': key,
    //     ...entry,
    //   });

    // });
    // this.excelService.generateExcel_withHeader(headers, data, 'recettes');
  }
}
