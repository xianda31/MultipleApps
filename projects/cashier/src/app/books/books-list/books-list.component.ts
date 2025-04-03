import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { BookEntry, Bank_accounts, FINANCIAL_ACCOUNT, Cashbox_accounts, Operation } from '../../../../../common/accounting.interface';
import { SystemDataService } from '../../../../../common/services/system-data.service';
import { BookService } from '../../book.service';
import { get_transaction } from '../../../../../common/transaction.definition';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-books-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './books-list.component.html',
  styleUrl: './books-list.component.scss'
})
export class BooksListComponent {
  // truncature = '1.2-2';  // '1.0-0';// '1.2-2';  //

  season: string = '';
  book_entries: BookEntry[] = [];
  truncature = '1.2-2';  // '1.0-0';// '1.2-2';  //


  constructor(
    private bookService: BookService,
    private systemDataService: SystemDataService,
    private router: Router,

  ) { }

  ngOnInit() {

    this.systemDataService.get_configuration().subscribe((conf) => {
      // this.expenses_accounts = conf.financial_tree.expenses.map((account) => account.key);
      // this.products_accounts = conf.financial_tree.revenues.map((account) => account.key);
      this.season = conf.season

      this.bookService.list_book_entries$(this.season).subscribe((book_entries) => {
        this.book_entries = [...book_entries];
      });
    });
  }

  total_amounts(entry: BookEntry): number {
    return Object.values(entry.amounts).reduce((a, b) => a + b, 0);
  }


  criterias: Set<'date' | 'in_out' | 'class' | 'type' | 'amount'> = new Set();
  sort_directions: { [key in 'date' | 'in_out' | 'class' | 'type' | 'amount']: number } = {
    date: 1,
    'in_out': 1,
    class: 1,
    type: 1,
    amount: 1
  };
  sort_clear() {
    this.criterias.clear();
    this.book_entries = this.bookService.get_book_entries();
  }

  sort_by(selected: 'date' | 'in_out' | 'class' | 'type' | 'amount') {

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
        case 'in_out':
          this.book_entries.sort((a, b) => {
            if (this.in_out(a) < this.in_out(b)) return -this.sort_directions[criteria];
            if (this.in_out(a) > this.in_out(b)) return this.sort_directions[criteria];
            return 0;
          });
          break;
        case 'class':
          this.book_entries.sort((a, b) => {
            if (a.class < b.class) return -this.sort_directions[criteria];
            if (a.class > b.class) return this.sort_directions[criteria];
            return 0;
          });
          break;
        case 'type':
          this.book_entries.sort((a, b) => {
            if (a.bank_op_type < b.bank_op_type) return -this.sort_directions[criteria];
            if (a.bank_op_type > b.bank_op_type) return this.sort_directions[criteria];
            return 0;
          });
          break;
        case 'amount':
          this.book_entries.sort((a, b) => {
            if (this.total_amounts(a) < this.total_amounts(b)) return -this.sort_directions[criteria];
            if (this.total_amounts(a) > this.total_amounts(b)) return this.sort_directions[criteria];
            return 0;
          });
          break
      };
    });
  }

  // sort_type_direction: number = 1;
  // sort_by_type() {
  //   this.sort_type_direction = - this.sort_type_direction;
  //   this.book_entries.sort((a, b) => {
  //     if (a.bank_op_type < b.bank_op_type) return -this.sort_type_direction;
  //     if (a.bank_op_type > b.bank_op_type) return this.sort_type_direction;
  //     return 0;
  //   });
  // }

  // sort_class_direction: number = 1;
  // sort_by_class() {
  //   this.sort_class_direction = - this.sort_class_direction;
  //   this.book_entries.sort((a, b) => {
  //     if (a.class < b.class) return -this.sort_class_direction;
  //     if (a.class > b.class) return this.sort_class_direction;
  //     return 0;
  //   });
  // }
  // sort_date_direction: number = 1;
  // sort_by_date() {
  //   this.sort_date_direction = - this.sort_date_direction;
  //   this.book_entries.sort((a, b) => {
  //     if (a.date < b.date) return -this.sort_date_direction;
  //     if (a.date > b.date) return this.sort_date_direction;
  //     return 0;
  //   });
  // }
  // sort_amount_direction: number = 1;
  // sort_by_amount() {
  //   this.sort_amount_direction = - this.sort_amount_direction;
  //   this.book_entries.sort((a, b) => {
  //     if (this.total_amounts(a) < this.total_amounts(b)) return -this.sort_amount_direction;
  //     if (this.total_amounts(a) > this.total_amounts(b)) return this.sort_amount_direction;
  //     return 0;
  //   });
  // }
  // sort_in_out_direction: number = 1;
  // sort_by_in_out() {
  //   this.sort_in_out_direction = - this.sort_in_out_direction;
  //   this.book_entries.sort((a, b) => {
  //     if (this.in_out(a) < this.in_out(b)) return -this.sort_in_out_direction;
  //     if (this.in_out(a) > this.in_out(b)) return this.sort_in_out_direction;
  //     return 0;
  //   });
  // }

  in_out(book_entry: BookEntry): boolean {
    let transaction = get_transaction(book_entry.bank_op_type);
    if (transaction === undefined) {
      console.log('oops , there is a problem', book_entry);
      return false;
    }
    return transaction.is_of_profit_type;
  }

  show_book_entry(book_entry_id: string) {
    this.router.navigate(['/books/editor', book_entry_id]);
  }
}
