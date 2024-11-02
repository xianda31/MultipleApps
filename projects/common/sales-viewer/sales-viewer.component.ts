import { Component, Input } from '@angular/core';
import { f_Sale, PaymentMode, Sale } from '../../cashier/src/app/shop/sales.interface';
import { SystemDataService } from '../services/system-data.service';
import { CommonModule } from '@angular/common';
import { SalesTabUtilities } from '../excel/sales-tab-utilities';


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
  product_accounts: string[] = [];
  payment_accounts: string[] = [];
  payMode = PaymentMode;

  constructor(
    private systemDataService: SystemDataService,
    private salesTabUtilities: SalesTabUtilities
  ) { }

  ngOnInit(): void {

    this.payment_accounts = Object.entries(this.payMode).map(([key, value]) => value);

    this.systemDataService.configuration$.subscribe((conf) => {
      this.product_accounts = conf.product_accounts.map((account) => account.key);
    });

    this.f_sales = this.salesTabUtilities.tabulate_sales(this.sales);
  }

  format_date(date: string): string {
    const formated_date = new Date(date);
    return formated_date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  }

}
