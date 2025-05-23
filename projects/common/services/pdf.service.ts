import { Injectable } from '@angular/core';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';


@Injectable({
  providedIn: 'root'
})
export class PdfService {

  constructor(
  ) { }


  generatePDF(contentToConvert: string, filename: string ) {
  const data = document.getElementById(contentToConvert);
  if (!data) {
    console.error("Element with id 'contentToConvert' not found.");
    return;
  }
  html2canvas(data).then(canvas => {
    const imgWidth = 208;
    const pageHeight = 295;
    const imgHeight = canvas.height * imgWidth / canvas.width;
    const heightLeft = imgHeight;

    const contentDataURL = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4'); // A4 size page of PDF

    let position = 0;
    pdf.addImage(contentDataURL, 'PNG', 0, position, imgWidth, imgHeight);

    pdf.save(filename); // Generated PDF
  });
}
}