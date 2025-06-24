import { Injectable } from '@angular/core';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

@Injectable({
  providedIn: 'root',
})
export class ExcelService {
  constructor() { }
  generateExcel(data: any[], fileName: string): void {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sheet 1');
    // Add headers
    const headers = Object.keys(data[0]);
    worksheet.addRow(headers);
    // Add data
    data.forEach((item) => {
      const row: any[] = [];
      headers.forEach((header) => {
        row.push(item[header]);
      });
      worksheet.addRow(row);
    });
    // Save the workbook to a blob
    workbook.xlsx.writeBuffer().then((buffer) => {
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `${fileName}.xlsx`);
    });
  }

  generateExcel_withHeader(headers: string[], data: any[], fileName: string): void {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sheet 1');
    // Add headers
    // const headers = Object.keys(data[0]);
    worksheet.addRow(headers);
    // Add data
    data.forEach((item) => {
      const row: any[] = [];
      headers.forEach((header) => {
        row.push(item[header]);
      });
      worksheet.addRow(row);
    });
    // Save the workbook to a blob
    workbook.xlsx.writeBuffer().then((buffer) => {
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `${fileName}.xlsx`);
    });
  }


  // unitary API

  createWorkbook(): ExcelJS.Workbook {
    return new ExcelJS.Workbook();
  }

  createWorksheet(workbook: ExcelJS.Workbook, name: string): ExcelJS.Worksheet {
    return workbook.addWorksheet(name);
  }
  addHeaderRow(worksheet: ExcelJS.Worksheet, headers: string[]): void {
    worksheet.addRow(headers);
  }
  addDataRow(worksheet: ExcelJS.Worksheet, data: { [key: string]: any }, headers: string[]): number {
    const row: any[] = [];
    headers.forEach((header) => {
      row.push(data[header]);
    });
    return worksheet.addRow(row).number;
  }

  mergeCellsOfCol(worksheet: ExcelJS.Worksheet, headers: string[], header: string, row_start: number, row_end: number): void {
    let col_nbr = headers.findIndex((hdr) => hdr === header);
    if (!col_nbr) {
      console.log('col %s not found', header);
      return;
    } else { col_nbr++; }
    let range = worksheet.getCell(row_start, col_nbr).fullAddress.address
      + ':' + worksheet.getCell(row_end, col_nbr).fullAddress.address;

    worksheet.mergeCells(range);
  }


  saveWorkbook(workbook: ExcelJS.Workbook, fileName: string): void {
    workbook.xlsx.writeBuffer().then((buffer) => {
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `${fileName}.xlsx`);
    });
  }

}