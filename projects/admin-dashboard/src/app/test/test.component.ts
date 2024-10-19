import { HttpClient, HttpResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import * as ExcelJS from 'exceljs';
import { Payment, PaymentMode, Sale, SaleItem } from '../../../../cashier/src/app/shop/cart/cart.interface';
import { MembersService } from '../members/service/members.service';
import { Member } from '../../../../common/member.interface';
import { CommonModule } from '@angular/common';
import { Bank } from '../../../../common/system-conf.interface';
import { Observable, of, tap, map } from 'rxjs';
import { SystemDataService } from '../../../../common/services/system-data.service';
import { SalesModule } from '../sales/sales.module';
@Component({
  selector: 'app-test',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './test.component.html',
  styleUrl: './test.component.scss'
})
export class TestComponent {
  members: Member[] = [];
  sales: Sale[] = [];
  payment_mode = PaymentMode;
  season: string = '';
  banks !: Bank[];
  season$: Observable<string> = of(this.season);
  loaded = false;

  constructor(
    private membersService: MembersService,
    private systemDataService: SystemDataService,

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
  }



  onChange(event: any) {
    const file = event.target.files[0];
    console.log('file', file);
    let workbook = new ExcelJS.Workbook();
    workbook.xlsx.load(file).then((workbook) => {
      this.process_exel_file(workbook);
    });
  }

  process_exel_file(workbook: ExcelJS.Workbook) {

    this.sales = [];
    // workbook.eachSheet((worksheet, sheetId) => { console.log('worksheet', worksheet?.name) });
    let worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
      return;
    }
    worksheet.eachRow((row, rowNumber) => {
      let colA = row.getCell(1).value;
      let colD = row.getCell(4).value;

      if (colA?.toString().startsWith('C') && colA?.toString() !== 'C999') {
        if (colD?.toString() !== 'transfert') {

          let { payment_mode, bank, cheque_no } = this.retrieve_pmode(row.getCell(8).value?.toString() as string);
          let sale: Sale = {
            amount: row.getCell(32).value?.valueOf() as number,
            payer_id: this.retrieve_member(row.getCell(5).value?.toString() as string),
            session: {
              season: '2023/24',
              vendor: 'uploader',
              event: row.getCell(2).value?.toString() as string,
            },
            payment: {
              payment_mode: payment_mode,
              bank: bank,
              cheque_no: cheque_no,
            },
            saleItems: this.process_products(row)
          };
          if (sale.payer_id !== '???') this.sales.push(sale);
          // console.log('Row ' + rowNumber + ' = ' + JSON.stringify(payment));
        }
      }
    });

  }

  retrieve_pmode(colH: string): { payment_mode: PaymentMode, bank: string, cheque_no: string } {
    if (colH === '' || colH === ' ' || colH === undefined) {
      return { payment_mode: PaymentMode.CASH, bank: '', cheque_no: '' };
    } else {
      // console.log('colH', colH);
      let key = colH.substring(0, 3);
      let cheque_no = colH.substring(3, 10);
      return { payment_mode: PaymentMode.CHEQUE, bank: key, cheque_no: cheque_no };
    }
  }

  retrieve_member(name: string): string {

    let concat = (name: string) => {
      return name.split('').filter(char => (char !== ' ' && char !== '-')).join('').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    };
    let z = concat(name);
    // let lastname = name.split(' ')[0].toUpperCase();
    // let firstname = name.split(' ')[1].toUpperCase();
    const member = this.members.find((member) => (concat(member.lastname + member.firstname)) === z);
    if (member) {
      return member.id;
    } else {
      if (z !== 'DROITSDETABLE' && z !== 'ERREURDECAISSE') console.log('%s not found : concatenated in [%s]', name, z);
      return '???';
    }
  }
  process_products(row: ExcelJS.Row): SaleItem[] {
    let saleItems: SaleItem[] = [];
    const product_columns = [
      { col: 9, name: 'autre' },
      { col: 10, name: 'PAF' },
      { col: 11, name: 'livre' },
      { col: 12, name: 'perf' },
      { col: 13, name: 'subvention' },
      { col: 14, name: 'adhesion' },
      { col: 15, name: 'licence' },
      { col: 16, name: 'droit de table' },
      { col: 17, name: 'carte' },
    ];
    product_columns.forEach((product) => {
      let price = row.getCell(product.col).value;
      if (price) {
        let saleItem: SaleItem = {
          product_id: product.name,
          payee_id: row.getCell(5).value?.toString() as string,
          price_payed: price.valueOf() as number,
        };
        saleItems.push(saleItem);
      }
    });
    return saleItems;
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
