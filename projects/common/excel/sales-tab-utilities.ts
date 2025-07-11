import { Injectable } from '@angular/core';
import { Product } from '../../web-back/src/app/sales/products/product.interface';
import { MembersService } from '../../web-back/src/app/members/service/members.service';
import { ExcelService } from '../../admin/src/app/excel.service';
import { ProductService } from '../services/product.service';
import { xls_header } from './excel.interface';
import { f_payments, f_products, f_Sale, PaymentMode, Sale } from '../../admin/src/app/shop/old_sales.interface';

@Injectable({
  providedIn: 'root'
})
export class SalesTabUtilities {

  products: Product[] = [];

  constructor(
    private membersService: MembersService,
    private productService: ProductService,
    private excelService: ExcelService


  ) {
    this.productService.listProducts().subscribe((products) => {
      this.products = products;
    });

  }


  // utility functions

  excelify_sales(sales: Sale[], filename: string) {

    const f_sales: f_Sale[] = this.tabulate_sales(sales);
    const wbk = this.excelService.createWorkbook();
    const wks = this.excelService.createWorksheet(wbk, filename);
    const headers = xls_header;

    this.excelService.addHeaderRow(wks, headers);

    f_sales.forEach((f_sale) => {
      let row_start = 0;
      let row_end = 0;
      Object.keys(f_sale.products).forEach((payee, index) => {
        let row: { [key: string]: any } = [];
        row['Date'] = new Date(f_sale.date);
        row['Bénéficiaire'] = payee;
        Object.keys(f_sale.products[payee]).forEach((product) => {
          row[product] = f_sale.products[payee][product];
        });

        if (index === 0) {   // only first row add payment data
          Object.keys(f_sale.payments).forEach((payment) => {
            switch (payment) {
              case PaymentMode.CASH:
                row['Caisse entrée'] = f_sale.payments[payment];
                break;
              case PaymentMode.CHEQUE:
                row['Caisse entrée'] = f_sale.payments[payment];
                row['Nature'] = 'chèque';
                break;
              case PaymentMode.CREDIT:
                row['Dette'] = f_sale.payments[payment];
                break;
              case PaymentMode.TRANSFER:
                row['Banque entrée'] = f_sale.payments[payment];
                row['Nature'] = 'virement';
                break;
            }
          });
          row_start = this.excelService.addDataRow(wks, row, headers);
          row_end = row_start;
        } else {
          row_end = this.excelService.addDataRow(wks, row, headers);
        }
      });
      if (row_end !== row_start) {
        this.excelService.mergeCellsOfCol(wks, headers, 'Nature', row_start, row_end);
        this.excelService.mergeCellsOfCol(wks, headers, 'Caisse entrée', row_start, row_end);
        this.excelService.mergeCellsOfCol(wks, headers, 'Banque entrée', row_start, row_end);

        // this.excelService.mergeCellsOfCol(wks, headers, 'Cheque No', row_start, row_end);

      }
    });
    this.excelService.saveWorkbook(wbk, filename);

  }


  tabulate_sales(sales: Sale[]): f_Sale[] {
    const f_sales: f_Sale[] = [];
    // formatage données payee_produits
    sales.forEach((sale) => {
      const date = sale.date;
      const products: f_products = {};
      const payments: f_payments = {};
      let reference: string | undefined = undefined;
      sale.records?.forEach((record) => {
        if (record.class.includes('Product')) {
          const payee = this.member_name(record.member_id!);
          // console.log('record', record);
          const product = this.products.find((product) => product.id === record.product_id);
          if (!product) {
            // console.log('ref. missing', record);
            return;
          }
          const product_key = product.account;
          const amount = record.amount;
          if (!products[payee]) {
            products[payee] = { [product_key]: amount };
          } else {
            if (!products[payee][product_key]) {
              products[payee][product_key] = amount;
            } else {
              products[payee][product_key] += amount;
            }
          }
        } else if (record.class.includes('Payment')) {
          const payment_key = record.mode!;
          const amount = record.amount;
          if (!payments[payment_key]) {
            payments[payment_key] = amount;
          } else {
            payments[payment_key] += amount;
          }
          reference = record.mode === PaymentMode.CHEQUE ? record.cheque : undefined;
        }
      });

      const payees_nbr = Object.keys(products).length;
      f_sales.push({
        sale_id: sale.id!,
        date: date,
        payees_nbr: payees_nbr,
        products: products,
        payments: payments,
        reference: reference
      });
    });

    return f_sales;
  }



  sort_by_date(f_sales: f_Sale[], up_sorting: boolean): f_Sale[] {
    let compare_up = (a: f_Sale, b: f_Sale) => new Date(a.date) < new Date(b.date) ? 1 : -1;
    let compare_down = (a: f_Sale, b: f_Sale) => new Date(a.date) > new Date(b.date) ? 1 : -1;

    if (up_sorting) {
      return f_sales.sort(compare_up);
    } else {
      return f_sales.sort(compare_down);
    }

  }

  total_payments(f_sales: f_Sale[]): f_payments {
    let total_payments: f_payments = {};
    f_sales.forEach((f_sale) => {
      Object.keys(f_sale.payments).forEach((payment) => {
        if (!total_payments[payment]) {
          total_payments[payment] = f_sale.payments[payment];
        } else {
          total_payments[payment] += f_sale.payments[payment];
        }
      });
    });
    return total_payments;
  }
  member_name(member_id: string) {
    let member = this.membersService.getMember(member_id);
    return member ? member.lastname.toLocaleUpperCase() + ' ' + member.firstname : '???';
  }

}