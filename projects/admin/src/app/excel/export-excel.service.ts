import { Injectable } from '@angular/core';
import { Component } from '@angular/core';
import { tap, switchMap, catchError, of } from 'rxjs';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { SystemConfiguration } from '../../../../common/system-conf.interface';
import { BookEntry } from '../../../../common/accounting.interface';
import { SystemDataService } from '../../../../common/services/system-data.service';
import { BookService } from '../book.service';
import { TransactionService } from '../transaction.service';
import { PRODUCTS_COL, COL, EXPENSES_COL, MAP_start, EXTRA_CUSTOMER_IN, FINANCIAL_COL_in, EXTRA_CUSTOMER_OUT, FINANCIAL_COL_out, MAP_end, TRANSACTION_ID_TO_CHRONO, CUSTOMER_COL, FINANCIAL_COL, MAP, TRANSACTION_ID_TO_NATURE } from '../../../../common/excel/excel.interface';

@Injectable({
  providedIn: 'root'
})
export class ExportExcelService {
  loaded: boolean = false;
  conf !: SystemConfiguration;
  season: string = '';
  book_entries!: BookEntry[];
  workbook!: ExcelJS.Workbook;
  worksheet !: ExcelJS.Worksheet;
  chrono = 1;
  revenue_keys: string[] = [];
  expense_keys: string[] = [];

  truncature = '1.2-2';  // '1.0-0';// '1.2-2';  //
  constructor(
    private bookService: BookService,
    private systemDataService: SystemDataService,
    private transactionService: TransactionService,

  ) {
    this.loaded = false;
    this.systemDataService.get_configuration().subscribe(
      (conf) => {
        this.conf = conf;
        this.season = conf.season;
      });

    this.bookService.list_book_entries().subscribe(
      (book_entries) => {
        this.book_entries = book_entries;
        this.loaded = true;
        this.revenue_keys = this.conf.revenue_and_expense_tree.revenues.map((item) => item.key);
        this.expense_keys = this.conf.revenue_and_expense_tree.expenses.map((item) => item.key);
      }),
      catchError((err) => {
        console.error('Error loading book entries:', err);
        this.loaded = true; // still loaded, but no entries
        return of([]);
      });
  }

  downloadToExcel() {
    if (!this.book_entries || this.book_entries.length === 0) {
      console.error('No book entries to export');
      return;
    }
    this.workbook = new ExcelJS.Workbook();
    this.worksheet = this.workbook.addWorksheet(this.season.replace(/\//g, '_'));

    this.create_HeaderRow();


    this.book_entries.forEach((entry) => {
      this.convertToRow(entry);
    });
    this.add_last_row();
    this.colorCells();
    this.add_borders();

    this.saveToExcel();
  }


  colorCells() {
    const products_fill: ExcelJS.FillPattern = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "4472C4" } // Standard blue
    };

    const expenses_fill: ExcelJS.FillPattern = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "70AD47" } // Standard green
    };

    Object.entries(PRODUCTS_COL).forEach(([key, value]) => {
      let columnNumber = COL[value as unknown as keyof typeof COL];
      this.worksheet.columns[columnNumber - 1].width = 5; // Set width for better visibility
      this.worksheet.eachRow((row, rowNumber) => {
        const cell = row.getCell(columnNumber);
        cell.fill = products_fill;
      });
    });
    Object.entries(EXPENSES_COL).forEach(([key, value]) => {
      let columnNumber = COL[value as keyof typeof COL];
      this.worksheet.columns[columnNumber - 1].width = 5; // Set width for better visibility

      this.worksheet.eachRow((row, rowNumber) => {
        const cell = row.getCell(columnNumber);
        cell.fill = expenses_fill;
      });
    });

  }

  add_borders() {
    const rowCount = this.worksheet.rowCount;
    const colCount = this.worksheet.columnCount;

    for (let i = 1; i <= rowCount; i++) {
      for (let j = 1; j <= colCount; j++) {
        const cell = this.worksheet.getRow(i).getCell(j);
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      }
    }
  }

  create_HeaderRow() {

    let header = [
      ...Object.keys(MAP_start),
      ...Object.keys(PRODUCTS_COL),
      ...Object.keys(EXPENSES_COL),
      ...Object.keys(EXTRA_CUSTOMER_IN),
      ...Object.keys(FINANCIAL_COL_in),
      ...Object.keys(EXTRA_CUSTOMER_OUT),
      ...Object.keys(FINANCIAL_COL_out),
      ...Object.keys(MAP_end),
    ];

    this.worksheet.addRow(header);

    this.worksheet.columns.forEach((col) => {
      col.font = { name: 'Colibri', size: 8 };
      col.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    this.worksheet.columns[3].width = 25; // nom
    this.worksheet.columns[3].alignment = { horizontal: 'left', vertical: 'middle' }
    this.worksheet.columns[4].width = 20;
    this.worksheet.columns[4].alignment = { horizontal: 'left', vertical: 'middle' }

    Object.entries(PRODUCTS_COL).forEach(([key, value]) => {
      let columnNumber = COL[value as keyof typeof COL];
      this.worksheet.columns[columnNumber - 1].font = { name: 'Colibri', size: 8, color: { argb: 'FFFFFFFF' } };
    });

  }

  add_last_row() {
    let last_row: any[] = ['Z999'];
    this.worksheet.addRow(last_row);
  }

  convertToRow(entry: BookEntry) {

    let transaction = this.transactionService.get_transaction(entry.transaction_id);
    if (transaction === undefined) {
      console.error('Transaction not found for entry:', entry);
      return;
    }
    let rows: any[] = [];
    let chrono_header = TRANSACTION_ID_TO_CHRONO[entry.transaction_id];

    if (entry.operations.length === 0) {

      let row: any[] = [
        chrono_header + ('00' + this.chrono++).slice(-3),
        new Date(entry.date),
        '' + new Date(entry.date).toLocaleDateString('fr-FR', { month: 'long' }),
        '',
        entry.tag,
      ];
      rows.push(row);

      this.add_financials(entry, rows[0])
      this.add_rows(rows);

    } else {


      // Add the operation values
      if (transaction.revenue_account_to_show === true) {

        entry.operations.forEach((op) => {

          let row: any[] = [
            chrono_header + ('00' + this.chrono++).slice(-3),
            new Date(entry.date),
            '' + new Date(entry.date).toLocaleDateString('fr-FR', { month: 'long' }),
            op.member ?? op.label,
            '',
          ];

          if (op.values) {
            Object.entries(PRODUCTS_COL).forEach(([key, col], index) => {
              if (op.values[key] !== undefined) {
                let column = COL[col as keyof typeof COL];
                row[column - 1] = op.values[key];
              }
            });

            row[(COL[CUSTOMER_COL.creance_in as keyof typeof COL]) - 1] = op.values['creance_in'] ? op.values['creance_in'] : '';
            row[(COL[CUSTOMER_COL.avoir_in as keyof typeof COL]) - 1] = op.values['avoir_in'] ? op.values['avoir_in'] : '';
          }

          rows.push(row);
        });


      } else {

        entry.operations.forEach((op) => {

          let row: any[] = [
            chrono_header + ('00' + this.chrono++).slice(-3),
            new Date(entry.date),
            '' + new Date(entry.date).toLocaleDateString('fr-FR', { month: 'long' }),
            op.member ?? op.label,
            '',
          ];
          if (op.values) {
            Object.entries(EXPENSES_COL).forEach(([key, col], index) => {
              if (op.values[key] !== undefined) {
                let column = COL[col as keyof typeof COL];
                row[column] = op.values[key];
              }
            });
          }
          row[(COL[CUSTOMER_COL.creance_out as keyof typeof COL]) - 1] = op.values['creance_out'] ? op.values['creance_out'] : '';
          row[(COL[CUSTOMER_COL.avoir_out as keyof typeof COL]) - 1] = op.values['avoir_out'] ? op.values['avoir_out'] : '';

          rows.push(row);

        });
      }

      this.add_financials(entry, rows[0])
      this.add_rows(rows);
    }

  }

  add_financials(entry: BookEntry, row: any[]) {
    Object.entries(FINANCIAL_COL).forEach(([key, value]) => {
      if (entry.amounts[key as keyof typeof entry.amounts] !== undefined) {
        let amount = entry.amounts[key as keyof typeof entry.amounts];
        let col = COL[value as keyof typeof COL] - 1;
        row[col] = amount;
      }
    });

    row[(COL[MAP['info'] as keyof typeof COL]) - 1] = entry.tag ?? '';
    row[(COL[MAP['pointage'] as keyof typeof COL]) - 1] = entry.bank_report ?? '';
    row[(COL[MAP['n° chèque'] as keyof typeof COL]) - 1] = entry.cheque_ref ?? '';
    row[(COL[MAP['bordereau'] as keyof typeof COL]) - 1] = entry.deposit_ref ?? '';

    // let transaction = this.transactionService.get_transaction(entry.transaction_id);
    let nature = TRANSACTION_ID_TO_NATURE[entry.transaction_id];
    if (nature) {
      row[(COL[MAP['nature'] as keyof typeof COL]) - 1] = nature;
    } else {

      console.warn('Transaction ID not found in TRANSACTION_ID_TO_NATURE:', entry.transaction_id);
    }

  }

  add_rows(rows: any[]) {
    const newRows = this.worksheet.addRows(rows);

    // merge cells if there are multiple rows

    if (rows.length > 1 && newRows.length > 0) {

      let start_row = newRows[0].number;
      let end_row = start_row + rows.length - 1;

      Object.values({ ...{ 'info': 'E' }, ...FINANCIAL_COL, ...MAP_end }).forEach(element => {
        this.worksheet.mergeCells(
          start_row,
          COL[element as keyof typeof COL],
          end_row,
          COL[element as keyof typeof COL]
        );
      });
    }
  }

  saveToExcel(fileName: string = 'book_entries') {

    // Save the workbook to a blob
    this.workbook.xlsx.writeBuffer().then((buffer) => {
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `${fileName}.xlsx`);
    });
  }

}
