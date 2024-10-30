import { Component } from '@angular/core';
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
@Component({
  selector: 'app-test',
  standalone: true,
  imports: [CommonModule, SalesViewerComponent],
  templateUrl: './test.component.html',
  styleUrl: './test.component.scss'
})
export class TestComponent {
  members: Member[] = [];
  sales: Sale[] = [];
  payment_mode = PaymentMode;
  season: string = '';
  banks !: Bank[];
  products: Product[] = [];
  season$: Observable<string> = of(this.season);
  loaded = false;
  worksheet!: ExcelJS.Worksheet;

  constructor(
    private membersService: MembersService,
    private systemDataService: SystemDataService,
    private productsService: ProductService,

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
      console.log('products', products);
    });
  }



  onChange(event: any) {
    const file = event.target.files[0];
    // console.log('file', file);
    let workbook = new ExcelJS.Workbook();
    workbook.xlsx.load(file).then((workbook) => {
      this.process_exel_file(workbook);
      this.loaded = true;

    });
  }

  process_exel_file(workbook: ExcelJS.Workbook) {

    this.sales = [];
    // workbook.eachSheet((this.worksheet, sheetId) => { console.log('this.worksheet', this.worksheet?.name) });
    let ws = workbook.getWorksheet(1);
    if (!ws) {
      return;
    } else {
      this.worksheet = ws;
    }



    // recherche des cellules mergées
    let addresses: { [master: string]: string[] } = {};
    let colAH = this.worksheet.getColumn(34);
    colAH.eachCell((cell, rowNumber) => {
      let Arow = this.worksheet.getCell('A' + rowNumber).toString();

      if (Arow.startsWith('C') && Arow !== 'C999') {
        let Drow = this.worksheet.getCell('D' + rowNumber).toString();
        if (Drow !== 'transfert') {
          let Erow = this.worksheet.getCell('E' + rowNumber).toString();
          const member = this.retrieve_member(Erow);
          if (member) {
            // console.log('row %s : %s %s %s', rowNumber, Arow, Drow, Erow);

            if (cell.isMerged) {
              let merge = cell.master.address;
              if (addresses[merge]) {
                addresses[merge].push(cell.address);
              } else {
                addresses[merge] = [cell.address];
              }
            } else {
              if (addresses[cell.address]) {
                addresses[cell.address].push(cell.address);
              } else {
                addresses[cell.address] = [cell.address];
              }
            }
          }
        }
      }
    });
    console.log('addresses', addresses);
    // traitement lignes du tableau addresses

    Object.entries(addresses).forEach(([master, cells]) => {

      this.analyse(master, cells)
    });


    this.worksheet.eachRow((row, rowNumber) => {
      // let colA = row.getCell(1).value;
      // let colD = row.getCell(4).value;
      // let colE = row.getCell(5).value;
      // let colG = row.getCell(7).value;
      // let colAE = row.getCell(31).value;
      // let colAF = row.getCell(32).value;
      // let colAH = row.getCell(34).value;

      // if (colA?.toString().startsWith('C') && colA?.toString() !== 'C999') {
      //   const member = this.retrieve_member(row.getCell(5).value?.toString() as string);
      //   if (colD?.toString() !== 'transfert' && member) {

      //     let { payment_mode, bank, cheque_no } = this.retrieve_pmode(colG?.toString() as string, row.getCell(8).value?.toString() as string);

      //     const amount = (payment_mode === PaymentMode.TRANSFER) ? colAH?.valueOf() as number : colAF?.valueOf() as number;
      //     console.log('row %s (%s) : %s => %s', rowNumber, payment_mode, colAH, amount);
      //     let records: Record[] = [{
      //       class: 'Payment_debit',
      //       season: '2023/24',
      //       amount: amount,
      //       mode: payment_mode,
      //       bank: bank,
      //       cheque_no: cheque_no,
      //       sale_id: 'tbd',
      //       member_id: row.getCell(5).value?.toString() as string,
      //     }];
      //     if (colAE?.toString() !== '0' && colAE?.toString() !== '0.00') {
      //       records.push({
      //         class: 'Payment_credit',
      //         season: '2023/24',
      //         member_id: row.getCell(5).value?.toString() as string,
      //         amount: colAE?.valueOf() as number,
      //         mode: PaymentMode.ASSETS,
      //         sale_id: 'tbd'
      //       });
      //     }
      //     records = [...records, ...this.process_products(row)];

      //     let sale: Sale = {
      //       // amount: row.getCell(32).value?.valueOf() as number,
      //       payer_id: this.retrieve_member(row.getCell(5).value?.toString() as string)?.id as string,
      //       season: '2023/24',
      //       vendor: 'uploader',
      //       event: row.getCell(2).value?.toString() as string,
      //       records: records,
      //     };
      //     if (sale.payer_id !== '???') this.sales.push(sale);
      //     // console.log('Row ' + rowNumber + ' = ' + JSON.stringify(payment));
      //   }
      // }
    });

  }

  analyse(master: string, cells: string[]) {
    // cells.forEach((cell) => { console.log('cell', cell) });
    // create sale (master)
    let row_number = +this.worksheet.getCell(master).row;
    let master_row = this.worksheet.getRow(row_number);
    let sale: Sale = {
      payer_id: this.retrieve_member(master_row.getCell(5).value?.toString() as string)?.id as string,
      season: '2023/24',
      vendor: 'uploader',
      event: master_row.getCell(2).value?.toString() as string,
      records: [],
    };

    // payment side
    let colE = master_row.getCell(5).value;
    let colG = master_row.getCell(7).value;
    let colH = master_row.getCell(8).value;
    let colAH = master_row.getCell(34).value;
    let colAE = master_row.getCell(31).value;
    let colAF = master_row.getCell(32).value;

    let { payment_mode, bank, cheque_no } = this.retrieve_pmode(colG?.toString() as string, colH?.toString() as string);
    const amount = (payment_mode === PaymentMode.TRANSFER) ? colAH?.valueOf() as number : colAF?.valueOf() as number;

    console.log('amount', amount);

    let records: Record[] = [{
      class: 'Payment_debit',
      season: '2023/24',
      amount: amount,
      mode: payment_mode,
      bank: bank,
      cheque_no: cheque_no,
      sale_id: master,
      member_id: colE?.toString() as string,
    }];
    if (colAE?.toString() !== '0' && colAE?.toString() !== '0.00') {
      records.push({
        class: 'Payment_credit',
        season: '2023/24',
        member_id: colE?.toString() as string,
        amount: colAE?.valueOf() as number,
        mode: PaymentMode.ASSETS,
        sale_id: master
      });
    }
    // products side

    cells.forEach((cell) => {
      let row_number = +this.worksheet.getCell(cell).row;
      let row = this.worksheet.getRow(row_number);
      records = [...records, ...this.process_products(row)];
    }
    );

    sale.records = records;
    console.log('master sale', sale);
    this.sales.push(sale);

  }

  retrieve_pmode(colG: string, colH: string): { payment_mode: PaymentMode, bank: string, cheque_no: string } {


    if (colH === '' || colH === ' ' || colH === undefined) {
      if (colG === 'espèces') return { payment_mode: PaymentMode.CASH, bank: '', cheque_no: '' };
      return { payment_mode: PaymentMode.TRANSFER, bank: '', cheque_no: '' };
    } else {
      // console.log('colH', colH);
      let key = colH.substring(0, 3);
      let cheque_no = colH.substring(3, 10);
      return { payment_mode: PaymentMode.CHEQUE, bank: key, cheque_no: cheque_no };
    }
  }

  retrieve_member(name: string): Member | null {

    let concat = (name: string) => {
      return name.split('').filter(char => (char !== ' ' && char !== '-')).join('').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    };
    let z = concat(name);
    // let lastname = name.split(' ')[0].toUpperCase();
    // let firstname = name.split(' ')[1].toUpperCase();
    const member = this.members.find((member) => (concat(member.lastname + member.firstname)) === z);

    if (member) {
      return member;
    } else {
      if (z !== 'DROITSDETABLE' && z !== 'ERREURDECAISSE') console.log('%s not found : concatenated in [%s]', name, z);
      return null;
    }
  }
  process_products(row: ExcelJS.Row): Record[] {
    let records: Record[] = [];
    const product_columns = [
      { col: 9, name: 'autre', account: 'OTH' },
      { col: 10, name: 'PAF', account: 'PAF' },
      { col: 11, name: 'livre', account: 'BIB' },
      { col: 12, name: 'perf', account: 'PER' },
      { col: 13, name: 'subvention', account: 'SUB' },
      { col: 14, name: 'adhesion', account: 'ADH' },
      { col: 15, name: 'licence', account: 'LIC' },
      { col: 16, name: 'droit de table', account: 'TAB' },
      { col: 17, name: 'carte', account: 'TAB' },
    ];
    product_columns.forEach((product) => {
      let price = row.getCell(product.col).value;
      if (price) {
        let prod_id = this.products.find((prod) => prod.price === price && prod.account === product.account);
        if (!prod_id) console.log('product not found', product.name, price);
        let record: Record = {
          class: 'Product_credit',
          product_id: prod_id ? prod_id.id : '???',
          season: this.season,
          member_id: this.retrieve_member(row.getCell(5).value?.toString() as string)?.id as string,
          amount: price.valueOf() as number,
          sale_id: 'tbd'
        };
        records.push(record);
      }
    });
    return records;
  }
  member_name(member_id: string) {
    let member = this.membersService.getMember(member_id);
    return member ? member.lastname.toLocaleUpperCase() + ' ' + member.firstname : '???';
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

  color_swapper(i: number) {
    return i % 2 === 0 ? 'table-light' : 'table-primary';
  }


}
