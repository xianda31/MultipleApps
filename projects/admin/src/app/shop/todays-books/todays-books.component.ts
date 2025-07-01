import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Router } from '@angular/router';
import { tap, switchMap, catchError, of } from 'rxjs';
import { SystemDataService } from '../../../../../common/services/system-data.service';
import { BookService } from '../../book.service';
import { TransactionService } from '../../transaction.service';
import { BookEntry, Revenue } from '../../../../../common/accounting.interface';
import { CommonModule } from '@angular/common';
import { PDF_table } from '../../../../../common/pdf-table.interface'

@Component({
  selector: 'app-todays-books',
  imports: [CommonModule],
  templateUrl: './todays-books.component.html',
  styleUrl: './todays-books.component.scss'
})
export class TodaysBooksComponent {
  @Input() today : string = new Date().toISOString().split('T')[0];
  @Output() pdf_table = new EventEmitter<PDF_table>();
  book_entries: BookEntry[] = [];
  sales_of_the_day: Revenue[] = [];

  constructor(
    private bookService: BookService,
    private systemDataService: SystemDataService,
    private transactionService: TransactionService,


  ) { }

  ngOnInit() {
    this.systemDataService.get_configuration().pipe(
      switchMap((conf) => this.bookService.list_book_entries$(conf.season)),
      catchError((err) => {
        return of([]);
      })
    ).subscribe(
      (book_entries) => {
        this.book_entries = book_entries;
        this.sales_of_the_day = this.bookService.get_revenues_from_members().filter((revenue) => revenue.date === this.today);
        this.pdf_table.emit(this.construct_pdf_table());
      }
    );
  }


  standalone_sale(index: number): boolean {
    if (index === 0) return true;
    let sale = this.sales_of_the_day[index];
    let prev = this.sales_of_the_day[index - 1];
    return sale.book_entry_id !== prev.book_entry_id;
  }
  payment_type(revenue: Revenue): string {
    let book_entry = this.book_entries.find((entry) => entry.id === revenue.book_entry_id);
    if (!book_entry) throw new Error('sale not found');
    return this.transactionService.get_transaction(book_entry.transaction_id).label;
  }

  sale_amount(revenue: Revenue): number {
    let book_entry = this.book_entries.find((entry) => entry.id === revenue.book_entry_id);
    if (!book_entry) throw new Error('sale not found');
    return (book_entry.amounts?.['cashbox_in'] ?? 0) + (book_entry.amounts?.['bank_in'] ?? 0);
  }

  construct_pdf_table() : PDF_table {
    
      const headers = ['Date', 'Transaction', 'Member', 'Amount'] ;
      const rows = this.sales_of_the_day.map((revenue) => {
        let book_entry = this.book_entries.find((entry) => entry.id === revenue.book_entry_id);
        if (!book_entry) throw new Error('sale not found');
        return [
          revenue.date,
          this.transactionService.get_transaction(book_entry.transaction_id).label,
          revenue.member,
          this.sale_amount(revenue).toFixed(2)
        ];
      })

      return {
        headers: headers,
        rows: rows
    };

  }
}
