import { CommonModule } from '@angular/common';
import { Component, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { BookEntry } from '../../../../../common/accounting.interface';
import { SystemDataService } from '../../../../../common/services/system-data.service';
import { BookService } from '../../book.service';
import { TransactionService } from '../../transaction.service';
import { map, Subscription, switchMap, tap } from 'rxjs';

type Fields = 'date' | 'classe' | 'transaction' | 'montant' | 'tag'
@Component({
  selector: 'app-books-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './books-list.component.html',
  styleUrl: './books-list.component.scss'
})
export class BooksListComponent implements OnDestroy {
  loaded: boolean = false;
  season: string = '';
  book_entries!: BookEntry[] ;
  truncature = '1.2-2';  // '1.0-0';// '1.2-2';  //
  book_subscription !: Subscription ;
  constructor(
    private bookService: BookService,
    private transactionService: TransactionService,
    private systemDataService: SystemDataService,
    private router: Router,

  ) { }

  ngOnInit() {

    this.loaded=false;
    this.book_subscription=this.systemDataService.get_configuration().pipe(
      tap((conf) => {
        this.season = conf.season;
        // console.log('got %s , then switchMap to season\'s entries', this.season);
      }),
      map((conf) => conf.season),
      switchMap((season) => this.bookService.list_book_entries$(season)),
      )
      .subscribe(
        (book_entries) => {
          this.book_entries = [...book_entries];
          this.loaded = true;
        }
      )

  }

  ngOnDestroy() {
    if (this.book_subscription) {
      // console.log('unsubscribing from book entries');
      this.book_subscription.unsubscribe();
    }
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
    this.router.navigate(['/finance/books/editor', book_entry_id]);
  }
}
