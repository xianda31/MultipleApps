import { Component, EventEmitter, Input, Output } from '@angular/core';
import { SystemDataService } from '../services/system-data.service';
import { CommonModule } from '@angular/common';
import { SalesTabUtilities } from '../excel/sales-tab-utilities';
import { PaymentMode } from '../new_sales.interface';


@Component({
  selector: 'app-sales-viewer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sales-viewer.component.html',
  styleUrl: './sales-viewer.component.scss'
})
export class SalesViewerComponent {
  @Input() sales!: Sale[];
  @Output() delete = new EventEmitter<string>();

  f_sales: f_Sale[] = [];
  product_accounts: string[] = [];
  payment_accounts: string[] = [];
  payMode = PaymentMode;
  up_sorting = false;

  constructor(
    private systemDataService: SystemDataService,
    private salesTabUtilities: SalesTabUtilities
  ) { }

  ngOnChanges(): void {
    this.f_sales = this.salesTabUtilities.tabulate_sales(this.sales);
    this.f_sales = this.salesTabUtilities.sort_by_date(this.f_sales, this.up_sorting);
  }

  ngOnInit(): void {

    this.payment_accounts = Object.entries(this.payMode).map(([key, value]) => value);

    this.systemDataService.configuration$.subscribe((conf) => {
      this.product_accounts = conf.product_accounts.map((account) => account.key);
    });
    // console.log('sales', this.sales);
    this.f_sales = this.salesTabUtilities.tabulate_sales(this.sales);
    this.f_sales = this.salesTabUtilities.sort_by_date(this.f_sales, this.up_sorting);

    // this.sort_by_date(this.up_sorting);

  }

  format_date(date: string): string {
    const formated_date = new Date(date);
    return formated_date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  }


  swap_date_sorting(): void {

    this.up_sorting = !this.up_sorting;
    this.f_sales = this.salesTabUtilities.sort_by_date(this.f_sales, this.up_sorting);
    // this.sort_by_date(this.up_sorting);

  }


  // sort_by_date(up_sorting: boolean): void {
  //   let compare_up = (a: f_Sale, b: f_Sale) => new Date(a.event) < new Date(b.event) ? 1 : -1;
  //   let compare_down = (a: f_Sale, b: f_Sale) => new Date(a.event) > new Date(b.event) ? 1 : -1;

  //   if (up_sorting) {
  //     this.f_sales.sort(compare_up);
  //   } else {
  //     this.f_sales.sort(compare_down);
  //   }

  // }

  delete_sale(f_sale: f_Sale): void {
    this.delete.emit(f_sale.sale_id);
  }




}
