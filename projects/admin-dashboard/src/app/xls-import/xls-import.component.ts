import { Component, signal } from '@angular/core';
import * as ExcelJS from 'exceljs';
import { MembersService } from '../members/service/members.service';
import { Member } from '../../../../common/member.interface';
import { CommonModule } from '@angular/common';
import { Bank } from '../../../../common/system-conf.interface';
import { Observable, of, tap, map } from 'rxjs';
import { SystemDataService } from '../../../../common/services/system-data.service';
import { PaymentMode, Record, Sale } from '../../../../cashier/src/app/shop/sales.interface';
import { SalesViewerComponent } from '../../../../common/sales-viewer/sales-viewer.component';
import { ProductService } from '../../../../common/services/product.service';
import { Product } from '../sales/products/product.interface';
import { SalesService } from '../../../../cashier/src/app/shop/sales.service';
import { COL, MAP, PRODUCTS } from '../../../../common/excel/excel.interface';
import { write } from '@popperjs/core';
@Component({
  selector: 'app-test',
  standalone: true,
  imports: [CommonModule, SalesViewerComponent],
  templateUrl: './xls-import.component.html',
  styleUrl: './xls-import.component.scss'
})
export class XlsImportComponent {
  members: Member[] = [];
  sales: Sale[] = [];
  payment_mode = PaymentMode;
  season: string = '';
  banks !: Bank[];
  products: Product[] = [];
  season$: Observable<string> = of(this.season);
  loaded = false;
  worksheet!: ExcelJS.Worksheet;
  // verbose: string = '';
  verbose = signal<string>('');
  excel_uploaded: boolean = false;

  constructor(
    private membersService: MembersService,
    private systemDataService: SystemDataService,
    private productsService: ProductService,
    private salesService: SalesService,

  ) {
    this.systemDataService.configuration$.pipe(
      tap((conf) => {
        this.season = conf.season;
        this.banks = conf.banks;
        // console.log('banks', this.banks);

      }),
      map((conf) => conf.season),
    ).subscribe((season) => { });

    this.membersService.listMembers().subscribe((members) => {
      this.members = members;
      // console.log('members', members);
    });

    this.productsService.listProducts().subscribe((products) => {
      this.products = products;
    });
  }



  onChange(event: any) {
    this.loaded = false;
    this.excel_uploaded = false;
    this.sales = [];
    const file = event.target.files[0];
    // console.log('file', file);
    let workbook = new ExcelJS.Workbook();
    workbook.xlsx.load(file).then((workbook) => {
      this.verbose.set('\n');
      this.process_exel_file(workbook);
      this.loaded = true;
      this.excel_uploaded = true;
    });
  }

  sales_validity_check(sales: Sale[]): boolean {
    let valid = true;
    sales.forEach((sale) => {
      if (!sale.records || sale.records.length === 0) {
        console.log('anomaly : no records in', sale);
        valid = false;
      } else {
        let total_credit = sale.records.reduce((acc, record) => record.class.includes('credit') ? acc + record.amount : acc, 0);
        let total_debit = sale.records.reduce((acc, record) => record.class.includes('debit') ? acc + record.amount : acc, 0);
        if (total_credit !== total_debit) {
          console.log('amounts not equal', total_credit, total_debit);
          console.log('sale', sale);
          this.verbose.set(this.verbose() + '[' + sale.payer_id + '] ' + 'montants non égaux : ' + total_credit + ' vs ' + total_debit + '\n');
          valid = false;
        }
      }
    });
    return valid;
  }

  data_store() {

    // verify sales integrity
    this.sales_validity_check(this.sales);
    console.log('sales', this.sales);
    // this.salesService.get_sales$(this.season).subscribe((sales) => {
    //   // delete ALL sales of the season
    //   sales.forEach((sale) => {
    //     this.salesService.cancel_sale$(sale.id!).subscribe((response) => {
    //       console.log('sale deleted', sale.id);
    //     });
    //   });

    //   // create new sales
    //   this.sales.forEach((sale) => {
    //     this.salesService.create_sale$(sale).subscribe((new_sale) => {
    //       sale.records!.forEach((record) => {
    //         record.sale_id = new_sale.id!;
    //         this.salesService.create_record$(record).subscribe((record) => {
    //         });
    //       });
    //     });
    //   });
    // });

    this.excel_uploaded = false;
  }

  process_exel_file(workbook: ExcelJS.Workbook) {
    let ws = workbook.getWorksheet(1);
    let meta_rows: { [master: string]: string[] } = {};


    if (!ws) {
      return;
    } else { this.worksheet = ws; }

    this.sales = [];
    let col_nature = this.worksheet.getColumn(MAP.nature);

    // recherche des cellules mergées (colonne Nature) => meta_rows

    col_nature.eachCell((cell, rowNumber) => {
      let cell_chrono = this.worksheet.getCell(MAP.chrono + rowNumber).toString();

      if (cell_chrono.startsWith('C') && cell_chrono !== 'C999') {

        if (cell.isMerged) {
          let merge = cell.master.address;
          if (meta_rows[merge]) {
            meta_rows[merge].push(cell.address);
          } else {
            meta_rows[merge] = [cell.address];
          }
        } else {
          if (meta_rows[cell.address]) {
            meta_rows[cell.address].push(cell.address);
          } else {
            meta_rows[cell.address] = [cell.address];
          }
        }

      }
    });

    // traitement lignes du tableau meta_rows (bloc de cellules mergées)

    Object.entries(meta_rows).forEach(([master, cells]) => {
      this.process(master, cells)
    });
  }

  process(master: string, cells: string[]) {
    // create sale (master)
    let row_number = +this.worksheet.getCell(master).row;
    let master_row = this.worksheet.getRow(row_number);
    let payer = this.retrieve_member(master_row.number, master_row.getCell(MAP.membre).value?.toString() as string);

    if (payer === null) {
      // console.log('payer not found', row_number);
      return;
    };
    let sale: Sale = {
      payer_id: payer.id,
      season: this.season,
      vendor: 'uploader',
      event: master_row.getCell(MAP.date).value?.toString() as string,
      records: [],
    };

    let col_member = master_row.getCell(MAP['membre']).value;
    // let col_nature = master_row.getCell(MAP['nature']).value;
    let col_pièce = master_row.getCell(MAP['n° pièce']).value;
    let col_dette = master_row.getCell(MAP['credit_in']).value;
    let col_avoir = master_row.getCell(MAP['avoir_in']).value;
    let col_caisse = master_row.getCell(MAP['espèces_in']).value;
    let col_banque = master_row.getCell(MAP['banque_in']).value;
    let records: Record[] = [];


    // construct payment side

    [{ col: col_dette, mode: PaymentMode.CREDIT },
    { col: col_avoir, mode: PaymentMode.ASSETS },
    { col: col_caisse, mode: PaymentMode.CASH },
    { col: col_banque, mode: PaymentMode.TRANSFER }]
      .forEach(({ col, mode }) => {

        if (!col?.valueOf()) { return; }

        let bank = (mode === PaymentMode.CHEQUE) ? col_pièce?.toString().substring(0, 3) : '';
        let cheque_no = (mode === PaymentMode.CHEQUE) ? col_pièce?.toString().substring(3, 10) : '';

        records.push({
          class: 'Payment_debit',
          season: this.season,
          amount: col?.valueOf() as number,
          mode: mode,
          bank: bank,
          cheque_no: cheque_no,
          sale_id: master,
          member_id: col_member?.toString() as string,
        });

      });

    // construct products side

    cells.forEach((cell) => {
      let row_number = +this.worksheet.getCell(cell).row;
      let row = this.worksheet.getRow(row_number);
      records = [...records, ...this.process_products(row)];
    }
    );

    // control amounts equality

    let total_credit = records.reduce((acc, record) => record.class.includes('credit') ? acc + record.amount : acc, 0);
    let total_debit = records.reduce((acc, record) => record.class.includes('debit') ? acc + record.amount : acc, 0);

    if (total_credit !== total_debit) {
      console.log('amounts not equal', total_credit, total_debit);
      console.log('sale', records);
      this.verbose.set(this.verbose() + '[' + row_number + '] ' + 'montants non égaux : ' + total_credit + ' vs ' + total_debit + '\n');
    }

    sale.records = records;
    this.sales.push(sale);

  }


  process_products(row: ExcelJS.Row): Record[] {
    let records: Record[] = [];

    PRODUCTS.forEach((product) => {
      // if (row.getCell(product.col).value !== null) {
      let cellValue = row.getCell(product.col).value;
      if (cellValue !== null && cellValue !== undefined) {
        let price = cellValue.valueOf() as number;
        let prod_id = this.products.find((prod) => prod.price === price && prod.account === product.account);
        if (!prod_id) {
          console.log('product not found', product.name, price);
          this.verbose.set(this.verbose() + '[' + row.number + ']' + product.name + ' at ' + price + '€ not found : ' + '\n');
        }
        let record: Record = {
          class: 'Product_credit',
          product_id: prod_id ? prod_id.id : '???',
          season: this.season,
          member_id: this.retrieve_member(row.number, row.getCell(MAP.membre).value?.toString() as string)?.id as string,
          amount: price,
          sale_id: 'tbd'
        };
        records.push(record);
      }
      // }
    });
    return records;
  }


  bank_name(bank_key: string) {
    let bank = this.banks.find((bank) => bank.key === bank_key);
    return bank ? bank.name : '???';
  }

  format_date(date: string): string {
    const formated_date = new Date(date);
    // return formatDate(date, 'EEEE d MMMM HH:00', 'fr-FR');
    return formated_date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric' });
  }

  format_vendor(vendor: string): string {
    const gliph = vendor.toLocaleLowerCase().split(' ').map((word) => word[0]).join('');
    return gliph;
  }

  retrieve_member(row_nbr: number, name: string): Member | null {
    let concat = (name: string) => {
      return name.split('').filter(char => (char !== ' ' && char !== '-')).join('').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    };

    let doejohn = concat(name);
    const member = this.members.find((member) => (concat(member.lastname + member.firstname)) === doejohn);

    if (member) { return member; }
    else {
      this.verbose.set(this.verbose() + '[' + row_nbr + '] ' + name + ' n\'est pas un adhérent connu : ' + '\n');
      return null;
    }
  }

}