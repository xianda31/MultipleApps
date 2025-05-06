import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { tap, switchMap } from 'rxjs';
import { SystemDataService } from '../../../../../../common/services/system-data.service';
import { BookService } from '../../../book.service';
import { BookEntry } from '../../../../../../common/accounting.interface';
interface EntryValue { total: number, entries: BookEntry[] };

@Component({
  selector: 'app-debts-details',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './debts-details.component.html',
  styleUrl: './debts-details.component.scss'
})
export class DebtsDetailsComponent {
  debts: Map<string, EntryValue> = new Map();
  current_debt_amount = 0;
  show_all_debts = false;
  truncature = '1.2-2';  // '1.0-0';// '1.2-2';  //
  constructor(
    private bookService: BookService,
    private systemDataService: SystemDataService,
    private router: Router,

  ) { }

  ngOnInit() {

    this.systemDataService.get_configuration().pipe(
      switchMap((conf) => this.bookService.list_book_entries$(conf.season)))
      .subscribe((book_entries) => {
        // this.book_entries = book_entries;

        this.debts = this.bookService.get_debts();
        this.current_debt_amount = this.debts.size > 0 ? Array.from(this.debts.values()).reduce((acc, debt) => acc + debt.total, 0) : 0;

      });

  }
  show_origin(selection: string) {
    let id = selection.split(' : ')[1];
    this.router.navigate(['/books/editor', id]);
  }

  compensate(key: string) {
    let amount = this.debts.get(key)!.total;
    let date = new Date().toISOString().split('T')[0]; // Format YYYY-MM-DD
    let member = key;
    console.log('cancel', date, member, amount);
    try {
      let entry = this.bookService.debt_cancelation(date, member, amount);
    }
    catch (error) {
      console.error('Error during asset compensation:', error);
    }

  }

}
