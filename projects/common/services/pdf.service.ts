import { Injectable } from '@angular/core';
import { jsPDF, } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PDF_table } from '../pdf-table.interface';

@Injectable({
  providedIn: 'root'
})
export class PdfService {

  constructor() { }

  generateTablePDF(tables: PDF_table[], filename: string) {
    const doc = new jsPDF();
    // Add custom text before tables
    let titleText = filename.replace('.pdf', '').replace(/_/g, ' ');
    let dateText = 'impression du :'+ new Date().toLocaleDateString();
    doc.setFontSize(12);
    doc.text(titleText, 14, 15);
    
    let lastY = 20; // initial Y position after text
    tables.forEach((table, idx) => {
      autoTable(doc, {
        head: [table.headers],
        body: table.rows,
        theme: 'grid',
        styles: { fontSize: 9, cellWidth: 'wrap' },
        startY: lastY,
        tableWidth: 'auto',
        columnStyles: {
          // Let columns shrink to fit page
        }
      });
      // @ts-ignore: autoTable adds lastAutoTable property
      lastY = (doc as any).lastAutoTable?.finalY + 10 || lastY + 40;
    });
    
    doc.setFontSize(8);
    doc.text(dateText, 14, lastY); 
    
    doc.save(filename);
  }
}