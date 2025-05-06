import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { BookEntry } from '../../../../../../common/accounting.interface';
import { SystemDataService } from '../../../../../../common/services/system-data.service';
import { BookService } from '../../../book.service';
import { switchMap, tap } from 'rxjs';
import { Router } from '@angular/router';
interface EntryValue { total: number, entries: BookEntry[] };

@Component({
  selector: 'app-assets-details',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './assets-details.component.html',
  styleUrl: './assets-details.component.scss'
})
export class AssetsDetailsComponent {
  assets: Map<string, EntryValue> = new Map();
  assets_entries: { [key: string]: EntryValue } = {};
  book_entries: BookEntry[] = [];
  show_all_assets = false;
  assets_amount = 0;
  truncature = '1.2-2';  // '1.0-0';// '1.2-2';  //
  loss_account_key = 'loss_account';
  profit_account_key = 'profit_account';

  constructor(
    private bookService: BookService,
    private systemDataService: SystemDataService,
        private router: Router,
    
  ) { }

  ngOnInit() {

    this.systemDataService.get_configuration().pipe(
      tap((conf) => {
        this.loss_account_key = conf.profit_and_loss.debit_key;
        this.profit_account_key = conf.profit_and_loss.credit_key;
      }),
      switchMap((conf) => this.bookService.list_book_entries$(conf.season)))
        .subscribe((book_entries) => {
        this.book_entries = book_entries;
        this.assets = this.bookService.get_customers_assets();
        this.assets_entries = Object.fromEntries(this.assets.entries());
        this.assets_amount = this.assets.size > 0 ? Array.from(this.assets.values()).reduce((acc, asset) => acc + asset.total, 0) : 0;

      });

  }

  show_origin(selection: string) {
    let id = selection.split(' : ')[1];
    this.router.navigate(['/books/editor', id]);
  }

  compensate(key: string) {
    let entry = this.assets_entries[key];
    let amount = entry.total;
    let date = new Date().toISOString().split('T')[0]; // Format YYYY-MM-DD
    let member = key;
    try {
    let entry = this.bookService.asset_cancelation(date,member,amount);
    }
    catch (error) {
      console.error('Error during asset compensation:', error);
    }

  }
}
