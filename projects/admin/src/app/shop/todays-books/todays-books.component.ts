import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Router } from '@angular/router';
import { tap, switchMap, catchError, of } from 'rxjs';
import { SystemDataService } from '../../../../../common/services/system-data.service';
import { BookService } from '../../book.service';
import { TransactionService } from '../../transaction.service';
import { BookEntry, Revenue } from '../../../../../common/accounting.interface';
import { CommonModule } from '@angular/common';
import { HorizontalAlignment, PDF_table } from '../../../../../common/pdf-table.interface'
import { TRANSACTION_CLASS } from '../../../../../common/transaction.definition';

@Component({
  selector: 'app-todays-books',
  imports: [CommonModule],
  templateUrl: './todays-books.component.html',
  styleUrl: './todays-books.component.scss'
})
export class TodaysBooksComponent {
  @Input() today: string = new Date().toISOString().split('T')[0];
  @Output() pdf_table = new EventEmitter<PDF_table>();
  today_book_entries: BookEntry[] = [];
  sales_of_the_day: Revenue[] = [];

  constructor(
    private bookService: BookService,
    private transactionService: TransactionService,


  ) { }

  ngOnInit() {

    this.bookService.get_sales_of_the_day(this.today).subscribe(
      (book_entries) => {
        this.today_book_entries = book_entries
        this.sales_of_the_day = this.bookService.book_entries_to_revenues(book_entries);
        this.pdf_table.emit(this.construct_pdf_table(this.today_book_entries));
      }),
      catchError((err) => {
        console.error('Error loading book entries:', err);
        return of([]);
      });
  }


  standalone_sale(index: number): boolean {
    if (index === 0) return true;
    let sale = this.sales_of_the_day[index];
    let prev = this.sales_of_the_day[index - 1];
    return sale.book_entry_id !== prev.book_entry_id;
  }
  payment_type(revenue: Revenue): string {
    let book_entry = this.today_book_entries.find((entry) => entry.id === revenue.book_entry_id);
    if (!book_entry) throw new Error('sale not found');
    return this.transactionService.get_transaction(book_entry.transaction_id).label;
  }

  sale_amount(revenue: Revenue): number {
    let book_entry = this.today_book_entries.find((entry) => entry.id === revenue.book_entry_id);
    if (!book_entry) throw new Error('sale not found');
    return (book_entry.amounts?.['cashbox_in'] ?? 0) + (book_entry.amounts?.['bank_in'] ?? 0);
  }




  construct_pdf_table(book_entries: BookEntry[]): PDF_table {
    // Format this.today (YYYY-MM-DD) to DD/MM/YYYY (French style)
    const [year, month, day] = this.today.split('-');
    const todayFr = `${day}/${month}/${year}`;
    const title = 'recettes du ' + todayFr;

    const headers = ['Montant', 'Transaction', 'Adhérent', 'Articles'];
    const alignments: HorizontalAlignment[] = ['right', 'left', 'left', 'left'];

    const rows = book_entries.map((book_entry) => {
      let transaction = this.transactionService.get_transaction(book_entry.transaction_id);
      let amount = (book_entry.amounts?.['cashbox_in'] ?? 0) + (book_entry.amounts?.['bank_in'] ?? 0);
      return [
        amount.toFixed(2) + ' €',
        transaction.label + (book_entry.cheque_ref ? ' (' + book_entry.cheque_ref + ')' : ''),
        book_entry.operations.map(op => op.member).join('\n'),
        book_entry.operations.map(op => Object.entries(op.values).reduce((acc, [key, value]) => acc + (key + '[' + value + '] '), '')).join('\n')
      ]
    });
    return {
      title: title,
      headers: headers,
      alignments: alignments,
      rows: rows
    };

  }
}
