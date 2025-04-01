import { Component, signal } from '@angular/core';
import * as ExcelJS from 'exceljs';
import { EXPENSES_COL, FINANCIAL_COL, MAP, PRODUCTS_COL } from '../../../../../common/excel/excel.interface';
import { ENTRY_TYPE, BookEntry, FINANCIAL_ACCOUNT, operation_values, Operation, BOOK_ENTRY_CLASS } from '../../../../../common/accounting.interface';
import { Member } from '../../../../../common/member.interface';
import { MembersService } from '../../../../../admin-dashboard/src/app/members/service/members.service';
import { BookService } from '../../book.service';
import { CommonModule, formatDate } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SystemDataService } from '../../../../../common/services/system-data.service';
import { get_transaction, Transaction } from '../../../../../common/transaction.definition';

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

  book_entries: BookEntry[] = [];

  members: Member[] = [];
  current_season: string = '';
  excel_data_loaded: boolean = false;
  verbose = signal<string>('');
  progress_style = 'width: 0%';
  create_progress = 0;
  data_uploading = false;

  constructor(
    private bookService: BookService,
    private membersService: MembersService,
    private systemDataService: SystemDataService,
  ) {

    this.systemDataService.get_configuration().subscribe((conf) => {
      this.current_season = conf.season;
    });

    this.membersService.listMembers().subscribe((members) => {
      this.members = members;
    });

  }

  onFileChange(event: any) {
    this.excel_data_loaded = false;
    const file = event.target.files[0];
    let workbook = new ExcelJS.Workbook();
    workbook.xlsx.load(file).then((workbook) => {
      this.verbose.set('\n');
      this.workbook = workbook;
      this.worksheets = workbook.worksheets;
      console.log('worksheets', this.worksheets);
    })
      .catch((error) => {
        console.log('error', error);
      });
  }

  select_sheet() {
    this.process_exel_file(this.worksheet);
    this.excel_data_loaded = true;

  }


  process_exel_file(worksheet: ExcelJS.Worksheet) {
    this.worksheet = worksheet;
    console.log('processing worksheet ', this.worksheet.name);
    this.book_entries = [];

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
          this.book_entries.push(book_entry);
        })
        .catch((error) => {
          console.log('error at  %s', master, error);
          console.log('import abandonné');
          return;
        }
        );
    });



  }
  upload_data() {

    let progress = (index: number) => {
      this.create_progress = Math.round((index) / this.book_entries.length * 100);
      this.progress_style = 'width: ' + this.create_progress + '%';
      if (index === this.book_entries.length) {
        this.data_uploading = false;
        this.verbose.set(this.verbose() + 'import terminé');
      }
    }

    this.data_uploading = true;
    let nb_create = 0;
    this.verbose.set(this.verbose() + 'uploading .. \n');
    this.bookService.bulk_create_book_entries$(this.book_entries).subscribe((responses) => {
      progress(this.book_entries.length);
      console.log('%s => %s', nb_create, JSON.stringify(responses));
    });
  }

  // old_upload_data() {
  //   let progress = (index: number) => {
  //     this.create_progress = Math.round((index) / this.book_entries.length * 100);
  //     this.progress_style = 'width: ' + this.create_progress + '%';
  //     if (index === this.book_entries.length) {
  //       this.data_uploading = false;
  //       this.verbose.set(this.verbose() + 'import terminé');
  //     }
  //   }


  //   this.data_uploading = true;
  //   let nb_create = 0;
  //   this.verbose.set(this.verbose() + 'uploading .. \n');
  //   this.book_entries.forEach((book_entry, index) => {
  //     this.bookService.create_book_entry(book_entry)
  //       .then(() => {
  //         progress(index + 1);
  //       }
  //       ).catch((error) => {
  //         progress(index + 1);
  //         console.log('error', error);
  //       }
  //       );
  //   });

  // }

  show_data() {
    this.verbose.set(this.verbose() + 'viewing .. \n');
    this.book_entries.forEach((book_entry, index) => {
      this.verbose.set(this.verbose() + JSON.stringify(book_entry) + '\n');
    });
  }


  async convert_to_book_entry(master: string, cells: string[]): Promise<BookEntry> {

    let promise = new Promise<BookEntry>((resolve, reject) => {
      // initializing book_entry
      let row_number = +this.worksheet.getCell(master).row;
      let master_row = this.worksheet.getRow(row_number);
      let date = master_row.getCell(MAP.date).value?.toString() || '';

      let cell_chèque = master_row.getCell(MAP['n° chèque']).value;
      let cell_bordereau = master_row.getCell(MAP['bordereau']).value;
      let cell_nature = master_row.getCell(MAP['nature']).value;
      let cell_info_sup = master_row.getCell(MAP['info']).value;

      let bank_op_type = this.convert_to_bank_op_type(cell_nature?.toString() as string);
      let transaction = get_transaction(bank_op_type)

      let book_entry: BookEntry = {
        season: this.systemDataService.get_season(new Date(date)),
        date: formatDate(new Date(date), 'yyyy-MM-dd', 'en'),
        id: '',
        amounts: {},
        operations: [],
        bank_op_type: bank_op_type,
        class: transaction.class,
      };
      if (cell_info_sup?.toString().startsWith('#')) {
        book_entry.tag = cell_info_sup?.toString() as string;
      }

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

      cells.forEach((cell, index) => {
        let row_number = +this.worksheet.getCell(cell).row;
        let row = this.worksheet.getRow(row_number);


        let operation = this.compute_operation_amounts(transaction, row);
        if (operation === null) {
          console.log('operation translation went wrong', row_number);
          reject('operation translation went wrong');
          return;
        }

        book_entry.operations.push(operation);
      });

      if (!this.control_amounts_balance(row_number, book_entry)) {
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
          case 'virement reçu':
            return ENTRY_TYPE.payment_by_transfer;
          case 'chèque':
            return ENTRY_TYPE.payment_by_cheque;
          case 'espèces':
            return ENTRY_TYPE.payment_in_cash;
          default:
            console.log('erreur de nature', nature);
            throw new Error('erreur de nature ' + nature);
            return ENTRY_TYPE.cash_receipt;
        }

      case 'droits de table':
        return ENTRY_TYPE.cash_receipt;

      default:
        console.log('erreur de feuille', this.worksheet.name);
        return ENTRY_TYPE.cash_receipt;
    }
  }
  control_amounts_balance(row_nbr: number, book_entry: BookEntry): boolean {
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
    if (book_entry.class === BOOK_ENTRY_CLASS.a_REVENUE_FROM_MEMBER || book_entry.class === BOOK_ENTRY_CLASS.c_OTHER_REVENUE) {
      products_sum += sum;
    } else if (book_entry.class === BOOK_ENTRY_CLASS.b_OTHER_EXPENSE) {
      expenses_sum += sum;
    }

    if (total !== (products_sum - expenses_sum)) {
      console.log('amounts not equal', total_debit, total_credit, products_sum, expenses_sum);
      console.log('book_entry', book_entry);
      this.verbose.set(this.verbose() + '[' + row_nbr + '] montants non égaux : ' + total_debit + ' vs ' + total_credit + '\n');
      return false;
    }
    // console.log('amounts are equal', total_debit, total_credit, products_sum, expenses_sum);

    return true;
  }

  compute_operation_amounts(transaction: Transaction, row: ExcelJS.Row): Operation {
    let operation: Operation = {
      label: row.getCell(MAP.intitulé).value?.toString() as string,
      values: {}
    };
    switch (transaction.class) {
      case BOOK_ENTRY_CLASS.a_REVENUE_FROM_MEMBER:
      case BOOK_ENTRY_CLASS.c_OTHER_REVENUE:
        operation.values = this.get_revenues_amounts(row);
        break;
      case BOOK_ENTRY_CLASS.b_OTHER_EXPENSE:
        operation.values = this.get_expenses_amounts(row);
        break;
      case BOOK_ENTRY_CLASS.e_MOVEMENT:
        operation.values = {};
        break;
    }

    switch (transaction.nominative) {
      case true:
        let cell_member = row.getCell(MAP.intitulé).value?.toString() || '';
        let member = this.retrieve_member(row.number, cell_member);
        if (member === null) {
          console.log('member not found', row.number);
          return operation;
        } else {
          operation.member = member.lastname + ' ' + member.firstname;
          operation.label = 'vente adhérent';
        }
        break;
      case false:
        operation.label = row.getCell(MAP.intitulé).value?.toString() as string;
        break;
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
