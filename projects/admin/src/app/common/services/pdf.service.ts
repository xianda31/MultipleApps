import { Injectable } from '@angular/core';
import { jsPDF, } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { HorizontalAlignment, PDF_table } from '../interfaces/pdf-table.interface';

@Injectable({
  providedIn: 'root'
})
export class PdfService {

  constructor() { }

  generateTablePDF(
    tables: PDF_table[],
    filename: string,
  ) {
    const doc = new jsPDF();
    // Add custom text before tables
    let titleText = filename.replace('.pdf', '').replace(/_/g, ' ');
    let dateText = 'imprimé le :' + new Date().toLocaleDateString();
    doc.setFontSize(12);
    doc.text(titleText, 14, 15);

    
    let lastY = 25; // initial Y position after text
    tables.forEach((table, idx) => {

// Add a title for each table
      if (table.title) {
        doc.setFontSize(10);
        doc.text(table.title, 14, lastY);
        lastY += 5; // space after title
      }

      // Convert array of alignments to columnStyles object
      const columnStyles: { [key: string]: Partial<{ halign: HorizontalAlignment }> } = {};
      table.alignments.forEach((align, idx) => {
        if (align) columnStyles[idx] = { halign: align };
      });
      autoTable(doc, {
        head: [table.headers],
        body: table.rows,
        theme: 'grid',
        styles: { fontSize: 9, cellWidth: 'wrap' },
        startY: lastY,
        tableWidth: 'auto',
        columnStyles: columnStyles
      });
      // @ts-ignore: autoTable adds lastAutoTable property
      lastY = (doc as any).lastAutoTable?.finalY + 10 || lastY + 40;
    });

    doc.setFontSize(8);
    doc.text(dateText, 14, lastY);

    doc.save(filename);
  }
}