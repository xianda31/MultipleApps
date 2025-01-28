import { Component, signal } from '@angular/core';
import * as ExcelJS from 'exceljs';
import { EXPENSES_COL, FINANCIAL_COL, MAP, PRODUCTS_COL } from '../../../../../common/excel/excel.interface';
import { ENTRY_TYPE, Bookentry, FINANCIAL_ACCOUNT, operation_values, Operation, BOOK_ENTRY_CLASS } from '../../../../../common/accounting.interface';
import { Member } from '../../../../../common/member.interface';
import { MembersService } from '../../../../../admin-dashboard/src/app/members/service/members.service';
import { BookService } from '../../book.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-import-excel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './import-excel.component.html',
  styleUrl: './import-excel.component.scss'
})


export class ImportExcelComponent {
  workbook!: ExcelJS.Workbook;
  worksheet !: ExcelJS.Worksheet;
  worksheets!: ExcelJS.Worksheet[];

  book_entrys: Bookentry[] = [];

  members: Member[] = [];
  season: string = '2024/2025';
  loaded = false;
  excel_uploaded: boolean = false;
  verbose = signal<string>('');
  progress_style = 'width: 0%';
  create_progress = 0;
  data_uploading = false;

  constructor(
    private bookService: BookService,
    private membersService: MembersService,
  ) {
    this.membersService.listMembers().subscribe((members) => {
      this.members = members;
    });

  }

  onFileChange(event: any) {
    this.loaded = false;
    this.excel_uploaded = false;
    const file = event.target.files[0];
    let workbook = new ExcelJS.Workbook();

    workbook.xlsx.load(file).then((workbook) => {
      this.verbose.set('\n');
      this.workbook = workbook;
      this.worksheets = workbook.worksheets;

    });
  }

  select_sheet() {
    this.process_exel_file(this.worksheet);
    this.loaded = true;
    this.excel_uploaded = true;

  }


  process_exel_file(worksheet: ExcelJS.Worksheet) {
    this.worksheet = worksheet;
    console.log('processing worksheet ', this.worksheet.name);
    this.book_entrys = [];

    // recherche balise ?999

    let cell_999 = this.worksheet.getColumn(MAP.chrono).values.find((cell) => cell && cell.toString().endsWith('999'));
    console.log('cell_999', cell_999);
    if (!cell_999) {
      console.log('balise 999 non trouvée');
      return;
    }


    let meta_rows: { [master: string]: string[] } = {};
    let col_nature = this.worksheet.getColumn(MAP.nature);

    // recherche des cellules mergées (colonne Nature) => meta_rows

    col_nature.eachCell((cell, rowNumber) => {
      let cell_chrono = this.worksheet.getCell(MAP.chrono + rowNumber).toString();

      if (cell_chrono.startsWith(cell_999!.toString().substring(0, 1)) && cell_chrono !== cell_999!.toString()) {

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
      this.convert_to_book_entry(master, cells)
        .then((book_entry) => {
          this.book_entrys.push(book_entry);
        })
        .catch((error) => {
          console.log('error at  %s', master, error);
          console.log('import abandonné');
          return;
        }
        );
    });

    console.log('%s écritures prêtes à être importées', this.book_entrys.length);


  }

  upload_data() {
    this.book_entrys.forEach((book_entry, index) => {
      this.bookService.create_book_entry(book_entry).then(() => {
        this.create_progress = Math.round((index + 1) / this.book_entrys.length * 100);
        this.progress_style = 'width: ' + this.create_progress + '%';
        if (this.create_progress === 100) {
          this.data_uploading = false;
          this.verbose.set(this.verbose() + 'import terminé');
        }
      }
      ).catch((error) => {
        console.log('error', error);
      }
      );
    });
  }


  async convert_to_book_entry(master: string, cells: string[]): Promise<Bookentry> {

    let promise = new Promise<Bookentry>((resolve, reject) => {
      // create sale (master)
      let row_number = +this.worksheet.getCell(master).row;

      // console.log('processing row %s', row_number);
      let master_row = this.worksheet.getRow(row_number);
      let date = master_row.getCell(MAP.date).value?.toString() || '';

      let cell_chrono = master_row.getCell(MAP.chrono).value?.toString() || '';
      if (cell_chrono.startsWith('C')) {
        let cell_member = master_row.getCell(MAP.intitulé).value?.toString() || '';
        if (cell_member !== '') {
          let member = this.retrieve_member(master_row.number, cell_member);
          if (member === null) {
            console.log('member not found', row_number);
            reject('member not found');
            return
          } else {
            // console.log('bénéficiaire', member.lastname + ' ' + member.firstname);
          }
        }
      }

      // let cell_nature = master_row.getCell(MAP['nature']).value;

      let cell_chèque = master_row.getCell(MAP['n° chèque']).value;
      let cell_bordereau = master_row.getCell(MAP['bordereau']).value;
      let cell_nature = master_row.getCell(MAP['nature']).value;


      let book_entry: Bookentry = {
        season: this.season,
        date: new Date(date).toISOString().split('T')[0],
        id: '',
        amounts: {},
        operations: [],
        bank_op_type: this.convert_to_bank_op_type(cell_nature?.toString() as string),
        class: cell_chrono.startsWith('C') ? BOOK_ENTRY_CLASS.REVENUE_FROM_MEMBER
          : (cell_chrono.startsWith('K') ? BOOK_ENTRY_CLASS.OTHER_REVENUE : BOOK_ENTRY_CLASS.EXPENSE)

      };

      if (cell_chèque?.toString()) { book_entry.cheque_ref = cell_chèque?.toString() as string; }
      if (cell_bordereau?.toString()) { book_entry.deposit_ref = cell_bordereau?.toString() as string; }

      // book_entry.amounts

      Object.entries(FINANCIAL_COL).forEach((entry) => {
        let [name, col] = entry;
        let cell = master_row.getCell(col).value;
        if (!cell?.valueOf()) { return; }
        book_entry.amounts[name as FINANCIAL_ACCOUNT] = cell.valueOf() as number;
      });

      // construct products operation side

      cells.forEach((cell) => {
        let row_number = +this.worksheet.getCell(cell).row;
        let row = this.worksheet.getRow(row_number);
        let operation = this.compute_operation_amounts(row);

        book_entry.operations.push(operation);
      });

      if (!this.control_amounts_balance(book_entry)) {
        reject('amounts not balanced');
      } else {
        resolve(book_entry);
      }
    });
    return promise;
  }

  convert_to_bank_op_type(nature: string): ENTRY_TYPE {
    switch (this.worksheet.name) {
      case 'chrono banque':

        switch (nature) {
          case 'dépôt':
            return ENTRY_TYPE.cash_deposit;
          case 'chèque':
            return ENTRY_TYPE.cheque_emit;
          case 'virement reçu':
            return ENTRY_TYPE.transfer_receipt;
          case 'virement emis':
            return ENTRY_TYPE.transfer_emit;
          case 'prélèvement':
            return ENTRY_TYPE.bank_debiting;
          case 'carte':
            return ENTRY_TYPE.card_payment;
          case 'versement compte épargne':
            return ENTRY_TYPE.saving_deposit;
          default:
            console.log('erreur de nature', nature);
            return ENTRY_TYPE.cash_receipt;
        }

      case 'chrono vente':

        switch (nature) {
          case 'virement':
            return ENTRY_TYPE.transfer_receipt;
          case 'chèque':
            return ENTRY_TYPE.cheque_deposit;
          default:
            return ENTRY_TYPE.cash_receipt;
        }

      case 'droits de table':
        return ENTRY_TYPE.cash_receipt;

      default:
        console.log('erreur de feuille', this.worksheet.name);
        return ENTRY_TYPE.cash_receipt;
    }
  }
  control_amounts_balance(book_entry: Bookentry): boolean {
    let debit_keys: FINANCIAL_ACCOUNT[] = Object.keys(book_entry.amounts).filter((key): key is FINANCIAL_ACCOUNT => key.includes('in'));
    let total_debit = debit_keys.reduce((acc, key) => acc + (book_entry.amounts[key] || 0), 0);

    let credit_keys: FINANCIAL_ACCOUNT[] = Object.keys(book_entry.amounts).filter((key): key is FINANCIAL_ACCOUNT => key.includes('out'));
    let total_credit = credit_keys.reduce((acc, key) => acc + (book_entry.amounts[key] || 0), 0);

    let total = total_debit - total_credit;

    let products_sum = 0;
    let expenses_sum = 0;
    let sum = 0;
    book_entry.operations.forEach((operation) => {
      sum += Object.values(operation.values).reduce((acc, value) => acc + value, 0);
    });
    if (book_entry.class === BOOK_ENTRY_CLASS.REVENUE_FROM_MEMBER || book_entry.class === BOOK_ENTRY_CLASS.OTHER_REVENUE) {
      products_sum += sum;
    } else if (book_entry.class === BOOK_ENTRY_CLASS.EXPENSE) {
      expenses_sum += sum;
    }

    if (total !== (products_sum - expenses_sum)) {
      console.log('amounts not equal', total_debit, total_credit, products_sum, expenses_sum);
      console.log('book_entry', book_entry);
      this.verbose.set(this.verbose() + 'montants non égaux : ' + total_debit + ' vs ' + total_credit + '\n');
      return false;
    }
    // console.log('amounts are equal', total_debit, total_credit, products_sum, expenses_sum);

    return true;
  }

  compute_operation_amounts(row: ExcelJS.Row): Operation {
    let operation!: Operation;
    let revenues = this.get_revenues_amounts(row);
    let cell_chrono = row.getCell(MAP.chrono).value?.toString() || '';
    if (Object.keys(revenues).length > 0) {
      operation = {
        label: row.getCell(MAP.intitulé).value?.toString() as string,
        // class: cell_chrono.startsWith('C') ? BOOK_ENTRY_CLASS.REVENUE_FROM_MEMBER : BOOK_ENTRY_CLASS.OTHER_REVENUE,
        values: revenues,
      };
    } else {
      let expenses = this.get_expenses_amounts(row);
      if (Object.keys(expenses).length > 0) {
        operation = {
          label: row.getCell(MAP.intitulé).value?.toString() as string,
          // class: BOOK_ENTRY_CLASS.EXPENSE,
          values: expenses,
        };
      } else {
        operation = {
          label: row.getCell(MAP.intitulé).value?.toString() as string,
          // class: BOOK_ENTRY_CLASS.MOVEMENT,
          values: {},
        };
      }
    }
    return operation;

  }

  get_revenues_amounts(row: ExcelJS.Row): operation_values {

    let values: operation_values = {};
    Object.entries(PRODUCTS_COL).forEach(element => {
      let [account, col] = element;
      let cellValue = row.getCell(col).value;
      if (cellValue !== null && cellValue !== undefined) {
        let price = cellValue.valueOf() as number;
        values[account] = price;
      }
    });
    return values;
  }

  get_expenses_amounts(row: ExcelJS.Row): operation_values {
    let values: operation_values = {};
    Object.entries(EXPENSES_COL).forEach((expense) => {
      let [account, col] = expense;
      let cellValue = row.getCell(col).value;
      if (cellValue !== null && cellValue !== undefined) {
        let price = cellValue.valueOf() as number;
        values[account] = price;
      }
    });

    return values;
  }


  retrieve_member(row_nbr: number, name: string): Member | null {
    if (name === null || name === undefined || name === '') {
      // this.verbose.set(this.verbose() + '[' + row_nbr + '] ' + 'nom non renseigné : ' + '\n');
      return null;
    }

    let concat = (name: string) => {
      return name.split('').filter(char => (char !== ' ' && char !== '-')).join('').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    };

    const member = this.members.find((member) => (concat(member.lastname + member.firstname)) === concat(name));

    if (member) {
      return member
    } else {
      this.verbose.set(this.verbose() + '[' + row_nbr + '] ' + name + ' n\'est pas un(e) adhérent(e) connu(e) : ' + '\n');
      return null;
    }
  }

}
