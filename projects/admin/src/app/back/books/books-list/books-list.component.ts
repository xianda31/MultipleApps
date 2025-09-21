import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { BackNavigationService } from '../../services/back-navigation.service';
import { BookEntry } from '../../../common/interfaces/accounting.interface';
import { SystemDataService } from '../../../common/services/system-data.service';
import { BookService } from '../../services/book.service';
import { of } from 'rxjs';
import { BooksExportExcelService } from '../books-export-excel.service';
import { TransactionService } from '../../services/transaction.service';

type Fields = 'date' | 'classe' | 'transaction' | 'montant' | 'tag'
@Component({
  selector: 'app-books-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './books-list.component.html',
  styleUrl: './books-list.component.scss'
})
export class BooksListComponent  {
  SLICE_SIZE = 15;
    slice_start = -this.SLICE_SIZE; // pour le slice des opérations

  loaded: boolean = false;
  season: string = '';
  book_entries!: BookEntry[];
  truncature = '1.2-2';  // '1.0-0';// '1.2-2';  //
  constructor(
    private bookService: BookService,
    private transactionService: TransactionService,
    private systemDataService: SystemDataService,
    private router: Router,
    private exportExcelService: BooksExportExcelService,
    private backNavigationService: BackNavigationService
  ) { }

  ngOnInit() {
    this.loaded = false;
    this.systemDataService.get_configuration().subscribe(
      (conf) => { this.season = conf.season; }
    );


    this.bookService.list_book_entries()
      .subscribe(
        (book_entries) => {
          this.book_entries = [...book_entries];
          this.loaded = true;
        }),
        (err: any) => {
          console.error('Error loading book entries:', err);
          this.loaded = true; // still loaded, but no entries
          return of([]);
        }
      
  }

  exportExcel() {
    this.exportExcelService.downloadToExcel();
  }

  total_amount(entry: BookEntry): number {
    return this.bookService.get_total_amount(entry);
  }


  criterias: Set<Fields> = new Set();
  sort_directions: { [key in Fields]: number } = {
    'date': 1,
    'classe': 1,
    'transaction': 1,
    'montant': 1,
    'tag': 1,
  };
  sort_clear() {
    this.criterias.clear();
    this.book_entries = this.bookService.get_book_entries();
  }

  sort_by(selected: Fields) {

    this.criterias.add(selected);
    this.sort_directions[selected] = -this.sort_directions[selected];
    Array.from(this.criterias).reverse().forEach((criteria) => {

      switch (criteria) {
        case 'date':
          this.book_entries.sort((a, b) => {
            if (a.date < b.date) return -this.sort_directions[criteria];
            if (a.date > b.date) return this.sort_directions[criteria];
            return 0;
          });
          break;
        case 'classe':
          this.book_entries.sort((a, b) => {
            if (this.class_label(a) < this.class_label(b)) return -this.sort_directions[criteria];
            if (this.class_label(a) > this.class_label(b)) return this.sort_directions[criteria];
            return 0;
          });
          break;
        case 'transaction':
          this.book_entries.sort((a, b) => {
            if (this.transaction_label(a) < this.transaction_label(b)) return -this.sort_directions[criteria];
            if (this.transaction_label(a) > this.transaction_label(b)) return this.sort_directions[criteria];
            return 0;
          });
          break;
        case 'montant':
          this.book_entries.sort((a, b) => {
            if (this.bookService.get_total_amount(a) < this.bookService.get_total_amount(b)) return -this.sort_directions[criteria];
            if (this.bookService.get_total_amount(a) > this.bookService.get_total_amount(b)) return this.sort_directions[criteria];
            return 0;
          });
          break
        case 'tag':
          this.book_entries.sort((a, b) => {
            if ((a.tag ?? '') < (b.tag ?? '')) return -this.sort_directions[criteria];
            if ((a.tag ?? '') > (b.tag ?? '')) return this.sort_directions[criteria];
            return 0;
          });
          break
      };
    });
  }



  transaction_label(book_entry: BookEntry): string {
    let transaction = this.transactionService.get_transaction(book_entry.transaction_id);
    if (transaction === undefined) {
      console.log('oops , there is a problem', book_entry);
      return '???';
    }
    return transaction.label;
  }

  class_label(book_entry: BookEntry): string {
    let transaction = this.transactionService.get_transaction(book_entry.transaction_id);
    if (transaction === undefined) {
      console.log('oops , there is a problem', book_entry);
      return '???';
    }
    return transaction.class;
  }


  show_book_entry(book_entry_id: string) {
    this.backNavigationService.goToBooksEditorFull(book_entry_id);
  }

  async delete_book_entry(book_entry: BookEntry) {
    await this.bookService.delete_book_entry(book_entry);
  }

   toggle_slice() {
    this.slice_start = (this.slice_start === 0) ? -this.SLICE_SIZE : 0;
  }

}
