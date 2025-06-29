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
  const margin_x = 10;
  const margin_y = 10;
  const imgWidth = 208- margin_x * 2; // A4 width in mm minus margins
  const pdf = new jsPDF('p', 'mm', 'a4'); // A4 size page of PDF

  html2canvas(data).then(canvas => {
    const imgHeight = canvas.height * imgWidth / canvas.width;
    const contentDataURL = canvas.toDataURL('image/png');
    pdf.addImage(contentDataURL, 'PNG', margin_x, margin_y, imgWidth, imgHeight);
    pdf.save(filename); 
  });
}
}