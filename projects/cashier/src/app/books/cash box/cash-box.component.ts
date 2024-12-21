import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { map, Observable } from 'rxjs';
import { SystemDataService } from '../../../../../common/services/system-data.service';
import { Sale, PaymentMode, f_Sale, f_payments } from '../../shop/old_sales.interface';
import { SalesViewerComponent } from "../../../../../common/sales-viewer/sales-viewer.component";
import { SalesTabUtilities } from '../../../../../common/excel/sales-tab-utilities';
import { ToastService } from '../../../../../common/toaster/toast.service';


@Component({
  selector: 'app-cash-box',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './cash-box.component.html',
  styleUrl: './cash-box.component.scss'
})
export class CashBoxComponent {
  sales_subscription: any;
  season_subscription: any;
  // payMode = PaymentMode;
  payment_accounts: string[] = Object.entries(PaymentMode).map(([key, value]) => value);
  total_payments !: f_payments;

  season: string = '';
  loaded = false;
  up_sorting = true;

  sales: Sale[] = [];
  f_sales: f_Sale[] = [];

  constructor(
    private systemDataService: SystemDataService,
    // private bookService: BookService,
    private salesTabUtilities: SalesTabUtilities,
    private toastService: ToastService,
  ) { }


  ngDestroy() {
    this.season_subscription.unsubscribe();
  }

  ngOnInit(): void {
    this.season_subscription = this.systemDataService.configuration$
      .subscribe((conf) => {
        this.season = conf.season;
        this.sales_subscription = this.load_sales(this.season);
      });
  }


  load_sales(season: string): any {
    this.loaded = false;
    return this.salesService.f_list_sales$(season).pipe(
      map((sales) => { return sales.sort((a, b) => a.date > b.date ? 1 : -1) })
    ).subscribe((sales) => {
      this.sales = sales;
      // console.log(this.sales);
      this.f_sales = this.salesTabUtilities.tabulate_sales(this.sales);
      this.f_sales = this.salesTabUtilities.sort_by_date(this.f_sales, this.up_sorting);
      this.total_payments = this.salesTabUtilities.total_payments(this.f_sales);
      // console.log(this.f_sales);
      this.loaded = true;
    });
  }

  change_season(event: any) {
    this.sales_subscription.unsubscribe();
    this.season = event.target.value;
    this.sales_subscription = this.load_sales(this.season);
  }

  // export_excel() {
  //   this.salesTabUtilities.excelify_sales(this.sales, 'revenues');
  // }

  format_date(date: string): string {
    const formated_date = new Date(date);
    // return formatDate(date, 'EEEE d MMMM HH:00', 'fr-FR');
    return formated_date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' });
  }

  swap_date_sorting(): void {

    this.up_sorting = !this.up_sorting;
    this.f_sales = this.salesTabUtilities.sort_by_date(this.f_sales, this.up_sorting);
    // this.sort_by_date(this.up_sorting);

  }
}

