import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { map, Observable } from 'rxjs';
import { SystemDataService } from '../../../../../common/services/system-data.service';
import { SalesService } from '../../shop/sales.service';
import { Sale, PaymentMode } from '../../shop/sales.interface';
import { SalesViewerComponent } from "../../../../../common/sales-viewer/sales-viewer.component";
import { SalesTabUtilities } from '../../../../../common/excel/sales-tab-utilities';


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
  payment_mode = PaymentMode;
  season: string = '';
  loaded = false;

  sales: Sale[] = [];

  constructor(
    private systemDataService: SystemDataService,
    private salesService: SalesService,
    private salesTabUtilities: SalesTabUtilities
  ) { }


  ngDestroy() {
    this.season_subscription.unsubscribe();
  }


  ngOnInit(): void {
    this.season_subscription = this.systemDataService.configuration$
      .subscribe((conf) => {
        this.season = conf.season;
        // this.banks = conf.banks;
        this.sales_subscription = this.list_sales$(this.season).subscribe((sales) => {
          this.sales = sales;
          this.loaded = true;
        });
      });
  }

  list_sales$(season: string): Observable<Sale[]> {
    return this.salesService.get_sales$(season).pipe(
      map((sales) => { return sales.sort((a, b) => a.event > b.event ? 1 : -1) })
    );
  }


  new_season(event: any) {
    this.sales_subscription.unsubscribe();
    this.season = event.target.value;
    this.loaded = false;
    this.sales_subscription = this.list_sales$(this.season).subscribe((sales) => {
      this.sales = sales;
      console.log('new season', this.sales);
      this.loaded = true;
    });
  }

  export_excel() {
    this.salesTabUtilities.excelify_sales(this.sales, 'revenues');
  }


}

