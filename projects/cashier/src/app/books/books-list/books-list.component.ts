import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { BookEntry } from '../../../../../common/accounting.interface';
import { SystemDataService } from '../../../../../common/services/system-data.service';
import { BookService } from '../../book.service';
import { Class_descriptions, Transaction} from '../../../../../common/transaction.definition';
import { TransactionService } from '../../transaction.service';

type Fields = 'date' | 'classe' | 'transaction' | 'montant' | 'tag'
@Component({
  selector: 'app-books-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './books-list.component.html',
  styleUrl: './books-list.component.scss'
})
export class BooksListComponent {

  season: string = '';
  book_entries: BookEntry[] = [];
  class_descriptions = Object(Class_descriptions);
  truncature = '1.2-2';  // '1.0-0';// '1.2-2';  //

  constructor(
    private bookService: BookService,
    private transactionService: TransactionService,
    private systemDataService: SystemDataService,
    private router: Router,

  ) { }

  ngOnInit() {

    this.systemDataService.get_configuration().subscribe((conf) => {
      this.season = conf.season

      this.bookService.list_book_entries$(this.season).subscribe((book_entries) => {
        this.book_entries = [...book_entries];
      });
    });
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
            if (a.class < b.class) return -this.sort_directions[criteria];
            if (a.class > b.class) return this.sort_directions[criteria];
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


  // in_out(book_entry: BookEntry): boolean {
  //   let transaction = get_transaction(book_entry.bank_op_type);
  //   if (transaction === undefined) {
  //     console.log('oops , there is a problem', book_entry);
  //     return false;
  //   }
  //   return transaction.is_of_profit_type;
  // }

  transaction_label(book_entry: BookEntry): string {
    let transaction = this.transactionService.get_transaction(book_entry.bank_op_type);
    if (transaction === undefined) {
      console.log('oops , there is a problem', book_entry);
      return '???';
    }
    return transaction.label;
  }

  show_book_entry(book_entry_id: string) {
    this.router.navigate(['/books/editor', book_entry_id]);
  }
}
