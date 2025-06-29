import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Router } from '@angular/router';
import { tap, switchMap } from 'rxjs';
import { SystemDataService } from '../../../../../../common/services/system-data.service';
import { BookService } from '../../../book.service';
import { BookEntry } from '../../../../../../common/accounting.interface';
import { BackComponent } from '../../../../../../common/back/back.component';
import { ToastService } from '../../../../../../common/toaster/toast.service';
interface EntryValue { total: number, entries: BookEntry[] };

@Component({
  selector: 'app-debts-and-assets-details',
  imports: [CommonModule],
  templateUrl: './debts-and-assets-details.component.html',
  styleUrl: './debts-and-assets-details.component.scss'
})
export class DebtsAndAssetsDetailsComponent {
  dues: Map<string, EntryValue> = new Map();
  dues_amount = 0;
  show_all_dues = false;
  truncature = '1.2-2';  // '1.0-0';// '1.2-2';  //
  @Input() due: 'dettes' | 'avoirs' = 'dettes';
  @Input() expert_mode = true;
  @Output() close = new EventEmitter<void>();
  constructor(
    private bookService: BookService,
    private systemDataService: SystemDataService,
    private toastService : ToastService,
    private router: Router,

  ) { }

  ngOnChanges() {
    this.prep_data();
  }

  prep_data() {
    switch (this.due) {
      case 'dettes':
        this.dues = this.bookService.get_debts();
        break;
      case 'avoirs':
        this.dues = this.bookService.get_customers_assets();
        break;
      default:
        throw new Error('Invalid due type');
    }
    this.dues_amount = this.dues.size > 0 ? Array.from(this.dues.values()).reduce((acc, debt) => acc + debt.total, 0) : 0;
  }

  ngOnInit() {

    this.systemDataService.get_configuration().pipe(
      switchMap((conf) => this.bookService.list_book_entries$(conf.season)))
      .subscribe((book_entries) => {
        // this.book_entries = book_entries;
        this.prep_data();

      });

  }

  onClose() {
    this.close.emit();
  }
  show_origin(selection: string) {
    let id = selection.split(' : ')[1];
    this.router.navigate(['finance/books/editor', id]);
  }

  async compensate(key: string) {
    let amount = this.dues.get(key)!.total;
    let date = new Date().toISOString().split('T')[0]; // Format YYYY-MM-DD
    let member = key;
    console.log('cancel', date, member, amount);
    try {
      let entry = await this.bookService.debt_cancelation(date, member, amount);
      this.dues.delete(key);
      this.toastService.showSuccess('Gestion dettes et crédits', `La compensation de ${amount} € pour ${member} a été enregistrée.`);

    }
    catch (error) {
      console.error('Error during asset compensation:', error);
    }

  }

}
