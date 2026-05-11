import { Injectable } from '@angular/core';
import { catchError, of } from 'rxjs';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { SystemConfiguration } from '../../common/interfaces/system-conf.interface';
import { BALANCE_ACCOUNT, BookEntry, CUSTOMER_ACCOUNT, FINANCIAL_ACCOUNT } from '../../common/interfaces/accounting.interface';
import { SystemDataService } from '../../common/services/system-data.service';
import { BookService } from '../services/book.service';
import { MAP_start, TRANSACTION_ID_TO_CHRONO, TRANSACTION_ID_TO_NATURE, ACCOUNTS_COL, buildDynamicExcelTemplateColumns } from '../../common/excel/excel.interface';
import { TransactionService } from '../services/transaction.service';

@Injectable({
  providedIn: 'root'
})
export class BooksExportExcelService {
  loaded: boolean = false;
  conf !: SystemConfiguration;
  season: string = '';
  book_entries!: BookEntry[];
  workbook!: ExcelJS.Workbook;
  worksheet !: ExcelJS.Worksheet;
  chrono = 1;
  
  // Colonnes dynamiques basées sur sys-conf
  dynamic_products_col: ACCOUNTS_COL = {};
  dynamic_expenses_col: ACCOUNTS_COL = {};
  dynamic_extra_customer_in: { [key in CUSTOMER_ACCOUNT]?: string } = {};
  dynamic_extra_customer_out: { [key in CUSTOMER_ACCOUNT]?: string } = {};
  dynamic_financial_col_in: { [key in FINANCIAL_ACCOUNT | BALANCE_ACCOUNT]?: string } = {};
  dynamic_financial_col_out: { [key in FINANCIAL_ACCOUNT | BALANCE_ACCOUNT]?: string } = {};
  dynamic_financial_col: { [key in FINANCIAL_ACCOUNT | BALANCE_ACCOUNT]?: string } = {};
  dynamic_map_end: { [key: string]: string } = {};
  dynamic_map: { [key: string]: string } = { ...MAP_start };
  dynamic_header: string[] = [];

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
        this.season = conf.season!;
        // Générer les mappings de colonnes dynamiques
        this.buildDynamicColumnMappings();
      });

    this.bookService.list_book_entries().subscribe(
      (book_entries) => {
        this.book_entries = book_entries;
        this.loaded = true;
      }),
      catchError((err) => {
        console.error('Error loading book entries:', err);
        this.loaded = true; // still loaded, but no entries
        return of([]);
      });
  }

  /**
   * Génère dynamiquement les mappings de colonnes pour les revenues et expenses
   * basés sur la configuration système
   */
  private buildDynamicColumnMappings(): void {
    if (!this.conf?.revenue_and_expense_tree) {
      console.warn('revenue_and_expense_tree not found in configuration');
      return;
    }

    const dynamicTemplate = buildDynamicExcelTemplateColumns(
      this.conf.revenue_and_expense_tree.revenues.map((revenue) => revenue.key),
      this.conf.revenue_and_expense_tree.expenses.map((expense) => expense.key),
    );

    this.dynamic_products_col = dynamicTemplate.products_col;
    this.dynamic_expenses_col = dynamicTemplate.expenses_col;
    this.dynamic_extra_customer_in = dynamicTemplate.extra_customer_in;
    this.dynamic_financial_col_in = dynamicTemplate.financial_col_in;
    this.dynamic_extra_customer_out = dynamicTemplate.extra_customer_out;
    this.dynamic_financial_col_out = dynamicTemplate.financial_col_out;
    this.dynamic_financial_col = dynamicTemplate.financial_col;
    this.dynamic_map_end = dynamicTemplate.map_end;
    this.dynamic_map = dynamicTemplate.map;
    this.dynamic_header = dynamicTemplate.header;
  }

  /**
   * Convertit une lettre de colonne Excel en index numérique (1-based)
   * A → 1, B → 2, ..., Z → 26, AA → 27, AB → 28, ...
   */
  private columnLetterToIndex(letter: string): number {
    let index = 0;
    for (let i = 0; i < letter.length; i++) {
      index = index * 26 + (letter.charCodeAt(i) - 64);
    }
    return index;
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

    // Appliquer couleur aux colonnes de revenues
    Object.entries(this.dynamic_products_col).forEach(([key, value]) => {
      let columnNumber = this.columnLetterToIndex(value);
      this.worksheet.columns[columnNumber - 1].width = 5;
      this.worksheet.eachRow((row, rowNumber) => {
        const cell = row.getCell(columnNumber);
        cell.fill = products_fill;
      });
    });

    // Appliquer couleur aux colonnes d'expenses
    Object.entries(this.dynamic_expenses_col).forEach(([key, value]) => {
      let columnNumber = this.columnLetterToIndex(value);
      this.worksheet.columns[columnNumber - 1].width = 5;
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
    this.worksheet.addRow(this.dynamic_header);

    this.worksheet.columns.forEach((col) => {
      col.font = { name: 'Colibri', size: 8 };
      col.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    this.worksheet.columns[3].width = 25; // nom
    this.worksheet.columns[3].alignment = { horizontal: 'left', vertical: 'middle' }
    this.worksheet.columns[4].width = 20;
    this.worksheet.columns[4].alignment = { horizontal: 'left', vertical: 'middle' }

    Object.entries(this.dynamic_products_col).forEach(([key, value]) => {
      let columnNumber = this.columnLetterToIndex(value);
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
    
    let chrono_header = TRANSACTION_ID_TO_CHRONO[entry.transaction_id];
    let firstRow: ExcelJS.Row | null = null;
    let lastRow: ExcelJS.Row | null = null;

    if (entry.operations.length === 0) {
      // Créer une ligne vide et remplir les colonnes dynamiquement
      const row = this.worksheet.addRow([]);
      firstRow = row;
      lastRow = row;
      
      // Remplir les colonnes de MAP_start
      this.setRowCellByMapKey(row, 'chrono', chrono_header + ('00' + this.chrono++).slice(-3), MAP_start);
      this.setRowCellByMapKey(row, 'date', new Date(entry.date), MAP_start);
      this.setRowCellByMapKey(row, 'mois', '' + new Date(entry.date).toLocaleDateString('fr-FR', { month: 'long' }), MAP_start);
      this.setRowCellByMapKey(row, 'intitulé', '', MAP_start);
      this.setRowCellByMapKey(row, 'info', entry.tag, MAP_start);
      this.setRowCellByMapKey(row, 'n° carte', '', MAP_start);
      
      this.add_financials(entry, row);

    } else {
      // Add the operation values
      if (transaction.revenue_account_to_show === true) {
        entry.operations.forEach((op, index) => {
          const row = this.worksheet.addRow([]);
          if (index === 0) firstRow = row;
          lastRow = row;
          
          // Remplir les colonnes de MAP_start
          this.setRowCellByMapKey(row, 'chrono', chrono_header + ('00' + this.chrono++).slice(-3), MAP_start);
          this.setRowCellByMapKey(row, 'date', new Date(entry.date), MAP_start);
          this.setRowCellByMapKey(row, 'mois', '' + new Date(entry.date).toLocaleDateString('fr-FR', { month: 'long' }), MAP_start);
          this.setRowCellByMapKey(row, 'intitulé', op.member ?? op.label, MAP_start);
          this.setRowCellByMapKey(row, 'info', '', MAP_start);

          // Remplir les colonnes de revenues dynamiques
          if (op.values) {
            Object.entries(this.dynamic_products_col).forEach(([key, colLetter]) => {
              if (op.values[key] !== undefined) {
                const colNum = this.columnLetterToIndex(colLetter);
                row.getCell(colNum).value = op.values[key];
              }
            });

            // Remplir les colonnes de customer accounts
            const creance_in_col = this.columnLetterToIndex(this.dynamic_extra_customer_in.creance_in as string);
            const avoir_in_col = this.columnLetterToIndex(this.dynamic_extra_customer_in.avoir_in as string);
            const creance_out_col = this.columnLetterToIndex(this.dynamic_extra_customer_out.creance_out as string);
            const avoir_out_col = this.columnLetterToIndex(this.dynamic_extra_customer_out.avoir_out as string);
            
            row.getCell(creance_in_col).value = op.values['creance_in'] ?? '';
            row.getCell(avoir_in_col).value = op.values['avoir_in'] ?? '';
            row.getCell(creance_out_col).value = op.values['creance_out'] ?? '';
            row.getCell(avoir_out_col).value = op.values['avoir_out'] ?? '';
          }

          if (index === 0) {
            this.add_financials(entry, row);
          }
        });
      } else {
        entry.operations.forEach((op, index) => {
          const row = this.worksheet.addRow([]);
          if (index === 0) firstRow = row;
          lastRow = row;
          
          // Remplir les colonnes de MAP_start
          this.setRowCellByMapKey(row, 'chrono', chrono_header + ('00' + this.chrono++).slice(-3), MAP_start);
          this.setRowCellByMapKey(row, 'date', new Date(entry.date), MAP_start);
          this.setRowCellByMapKey(row, 'mois', '' + new Date(entry.date).toLocaleDateString('fr-FR', { month: 'long' }), MAP_start);
          this.setRowCellByMapKey(row, 'intitulé', op.member ?? op.label, MAP_start);
          this.setRowCellByMapKey(row, 'info', '', MAP_start);

          // Remplir les colonnes d'expenses dynamiques
          if (op.values) {
            Object.entries(this.dynamic_expenses_col).forEach(([key, colLetter]) => {
              if (op.values[key] !== undefined) {
                const colNum = this.columnLetterToIndex(colLetter);
                row.getCell(colNum).value = op.values[key];
              }
            });
          }
          
          const creance_out_col = this.columnLetterToIndex(this.dynamic_extra_customer_out.creance_out as string);
          const avoir_out_col = this.columnLetterToIndex(this.dynamic_extra_customer_out.avoir_out as string);
          row.getCell(creance_out_col).value = op.values['creance_out'] ?? '';
          row.getCell(avoir_out_col).value = op.values['avoir_out'] ?? '';

          if (index === 0) {
            this.add_financials(entry, row);
          }
        });
      }
    }

    // Fusionner les cellules si plusieurs lignes
    if (firstRow && lastRow && firstRow.number !== lastRow.number) {
      this.mergeCellsForBookEntry(firstRow.number, lastRow.number);
    }
  }

  /**
   * Fusionne les cellules pour une BookEntry sur plusieurs lignes
   */
  private mergeCellsForBookEntry(startRowNum: number, endRowNum: number): void {
    const colsToMerge = [...new Set(Object.values({ ...MAP_start, ...this.dynamic_financial_col, ...this.dynamic_map_end }))];
    colsToMerge.forEach(colLetter => {
      const colNum = this.columnLetterToIndex(colLetter);
      this.worksheet.mergeCells(startRowNum, colNum, endRowNum, colNum);
    });
  }

  /**
   * Définit la valeur d'une cellule en utilisant la clé du MAP
   */
  private setRowCellByMapKey(row: ExcelJS.Row, mapKey: string, value: any, mapObj: { [key: string]: string }): void {
    const colLetter = mapObj[mapKey];
    if (colLetter) {
      const colNum = this.columnLetterToIndex(colLetter);
      row.getCell(colNum).value = value;
    }
  }

  /**
   * Ajoute les montants financiers à la ligne
   */
  add_financials(entry: BookEntry, row: ExcelJS.Row) {
    Object.entries(this.dynamic_financial_col).forEach(([key, colLetter]) => {
      if (entry.amounts[key as keyof typeof entry.amounts] !== undefined) {
        const amount = entry.amounts[key as keyof typeof entry.amounts];
        const colNum = this.columnLetterToIndex(colLetter as string);
        row.getCell(colNum).value = amount;
      }
    });

    // Ajouter les informations complémentaires
    this.setRowCellByMapKey(row, 'info', entry.tag ?? '', this.dynamic_map);
    this.setRowCellByMapKey(row, 'pointage', entry.bank_report ?? '', this.dynamic_map);
    this.setRowCellByMapKey(row, 'n° chèque', entry.cheque_ref ?? '', this.dynamic_map);
    this.setRowCellByMapKey(row, 'bordereau', entry.deposit_ref ?? '', this.dynamic_map);

    let nature = TRANSACTION_ID_TO_NATURE[entry.transaction_id];
    if (nature) {
      this.setRowCellByMapKey(row, 'nature', nature, this.dynamic_map);
    } else {
      console.warn('Transaction ID not found in TRANSACTION_ID_TO_NATURE:', entry.transaction_id);
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
