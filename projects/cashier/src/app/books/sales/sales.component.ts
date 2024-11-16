import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { map, Observable } from 'rxjs';
import { SystemDataService } from '../../../../../common/services/system-data.service';
import { SalesService } from '../../shop/sales.service';
import { Sale, PaymentMode } from '../../shop/sales.interface';
import { SalesViewerComponent } from "../../../../../common/sales-viewer/sales-viewer.component";
import { SalesTabUtilities } from '../../../../../common/excel/sales-tab-utilities';
import { ToastService } from '../../../../../common/toaster/toast.service';


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
      this.loaded = true;
    });
  }

  change_season(date: any) {
    this.sales_subscription.unsubscribe();
    this.season = date.target.value;
    this.sales_subscription = this.load_sales(this.season);
  }

  export_excel() {
    this.salesTabUtilities.excelify_sales(this.sales, 'revenues');
  }

  delete_sale(sale_id: string) {
    this.salesService.f_delete_sale$(sale_id).subscribe((done) => {
      if (done) {
        // delete locally
        this.sales = this.sales.filter((sale) => sale.id !== sale_id);
        this.toastService.showSuccessToast('vente supprimée', 'la vente a été supprimée');
      } else {
        this.toastService.showErrorToast('erreur', 'erreur lors de la suppression de la vente');
        console.log('error deleting sale');
      }
    });
  }
}

