import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { map, Observable } from 'rxjs';
import { SystemDataService } from '../../../../../common/services/system-data.service';
// import { SalesViewerComponent } from "../../../../../common/sales-viewer/sales-viewer.component";
// import { SalesTabUtilities } from '../../../../../common/excel/sales-tab-utilities';
import { ToastService } from '../../../../../common/toaster/toast.service';
import { BookService } from '../../book.service';
import { Financial, PaymentMode } from '../../../../../common/new_sales.interface';


@Component({
  selector: 'app-sales',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './sales.component.html',
  styleUrl: './sales.component.scss'
})
export class SalesComponent {
  sales_subscription: any;
  season_subscription: any;
  payment_mode = PaymentMode;
  season: string = '';
  loaded = false;

  sales: Financial[] = [];

  constructor(
    private systemDataService: SystemDataService,
    // private salesTabUtilities: SalesTabUtilities,
    private toastService: ToastService,
    private bookService: BookService
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
    this.bookService.list_financials$().subscribe((sales) => {
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
    // this.salesTabUtilities.excelify_sales(this.sales, 'revenues');
  }

  delete_sale(sale_id: string) {
    this.bookService.delete_financial(sale_id).then((done) => {
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

