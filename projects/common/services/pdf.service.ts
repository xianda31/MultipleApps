import { Injectable } from '@angular/core';
import { jsPDF ,} from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PDF_table } from '../pdf-table.interface';

@Injectable({
  providedIn: 'root'
})
export class PdfService {

  constructor() { }

  generateTablePDF(tables: PDF_table[], filename: string) {
    const doc = new jsPDF();
    let lastY = 10; // initial Y position
    tables.forEach((table, idx) => {
      autoTable(doc, {
        head: [table.headers],
        body: table.rows,
        theme: 'grid',
        styles: { fontSize: 10 },
        startY: lastY
      });
      // @ts-ignore: autoTable adds lastAutoTable property
      lastY = (doc as any).lastAutoTable?.finalY + 10 || lastY + 40;
    });
    doc.save(filename);
  }
}