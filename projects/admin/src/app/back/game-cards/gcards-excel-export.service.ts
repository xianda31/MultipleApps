import { Injectable } from '@angular/core';
import { GameCard } from './game-card.interface';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { MembersService } from '../../common/services/members.service';
@Injectable({
  providedIn: 'root'
})
export class GcardsExcelExportService {
  workbook!: ExcelJS.Workbook;
  worksheet !: ExcelJS.Worksheet;
  constructor(
    private membersService: MembersService
  ) { }

  /**
   * Helper method to parse stamp strings in various date formats
   */
  private parseStampDate(stamp: string): Date | null {
    // Try different date formats commonly used
    const formats = [
      // ISO format: YYYY-MM-DD
      /^(\d{4})-(\d{2})-(\d{2})$/,
      // European format: DD/MM/YYYY
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
      // US format: MM/DD/YYYY
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
      // Dot format: DD.MM.YYYY
      /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/
    ];

    for (const format of formats) {
      const match = stamp.match(format);
      if (match) {
        let day, month, year;
        
        if (format.toString().includes('(\\d{4})-')) {
          // ISO format: YYYY-MM-DD
          [, year, month, day] = match;
        } else {
          // Other formats: DD/MM/YYYY or MM/DD/YYYY
          [, day, month, year] = match;
        }
        
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }
    
    return null;
  }


  exportGameCardsToExcel(cards: GameCard[]) {

    this.workbook = new ExcelJS.Workbook();
    this.worksheet = this.workbook.addWorksheet('Cartes');

    // Define all columns at once including stamp columns
    const columns: Partial<ExcelJS.Column>[] = [
      { header: 'TITULAIRE_A', key: 'owner_a', width: 40 },
      { header: 'TITULAIRE_B', key: 'owner_b', width: 40 },
      { header: 'QTE_INITIALE', key: 'initial_qty', width: 15 },
      { header: 'RESTANT', key: 'left', width: 15 }
    ];

    // Add stamp columns with date format
    for (let i = 1; i <= 12; i++) {
      columns.push({
        header: `TAMPON_${i}`, 
        key: `stamp_${i}`, 
        width: 15,
        style: { numFmt: 'dd/mm/yyyy' }
      });
    }

    // Set all columns at once
    this.worksheet.columns = columns;


    // Add the game card data to the worksheet
    cards.forEach(card => {
      try {
        let row: { [key: string]: any } = {
          owner_a: this.membersService.full_name(card.owners[0]),
          owner_b: card.owners[1] ? this.membersService.full_name(card.owners[1]) : '',
          initial_qty: card.initial_qty,
          left: card.initial_qty - card.stamps.length,
        };

        card.stamps.forEach((stamp: string, index) => {
          // Convert stamp string to Date object for Excel compatibility
          let stampDate: Date | null = null;
          
          if (stamp && stamp.trim()) {
            try {
              // Parse the stamp string as a date
              const parsedDate = new Date(stamp);
              if (!isNaN(parsedDate.getTime())) {
                stampDate = parsedDate;
              } else {
                // If direct parsing fails, try with different formats
                // Handle common date formats like 'YYYY-MM-DD', 'DD/MM/YYYY', etc.
                const altDate = this.parseStampDate(stamp);
                if (altDate) {
                  stampDate = altDate;
                }
              }
            } catch (error) {
              console.warn(`Could not parse stamp as date: ${stamp}`, error);
            }
          }
          
          row[`stamp_${index + 1}`] = stampDate;
        });

        this.worksheet.addRow(row);
      } catch (error) {
        console.error('Error adding row for card:', card, error);
      }
    });

    // Save the workbook
    this.workbook.xlsx.writeBuffer().then((data) => {
      const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, 'game-cards.xlsx');
    }).catch((error) => {
      console.error('Error writing Excel file:', error);
    });
  }


    saveToExcel(fileName: string = 'book_entries') {
      try {
        // Save the workbook to a blob
        this.workbook.xlsx.writeBuffer().then((buffer) => {
          const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
          saveAs(blob, `${fileName}.xlsx`);
        }).catch((error) => {
          console.error('Error writing Excel file:', error);
        });
      } catch (error) {
        console.error('Error in saveToExcel:', error);
      }
    }
}
