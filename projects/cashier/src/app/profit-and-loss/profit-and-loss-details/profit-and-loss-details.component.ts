import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Sub_class } from '../../../../../common/system-conf.interface';
import { CommonModule } from '@angular/common';
import { SystemDataService } from '../../../../../common/services/system-data.service';
import { BookService } from '../../book.service';
import { Revenue, Expense, BookEntry } from '../../../../../common/accounting.interface';

@Component({
  selector: 'app-profit-and-loss-details',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './profit-and-loss-details.component.html',
  styleUrl: './profit-and-loss-details.component.scss'
})
export class ProfitAndLossDetailsComponent {
  type !: string;
  // key !: string;
  title: string = ''

  p_and_l_classes: { key: string, description: string }[] = [];
  revenue_classes: Sub_class[] = [];
  expense_classes: Sub_class[] = [];

  expenses_accounts !: string[];
  products_accounts !: string[];

  revenues!: Revenue[];
  expenses: Expense[] = [];

  book_entries: BookEntry[] = [];
  constructor(
    private route: ActivatedRoute,
    private bookService: BookService,
    private systemDataService: SystemDataService,
  ) { }

  ngOnInit(): void {


    this.systemDataService.get_configuration().subscribe((configuration) => {
      this.expenses_accounts = configuration.financial_tree.expenses.map((account) => account.key);
      this.products_accounts = configuration.financial_tree.revenues.map((account) => account.key);

      this.p_and_l_classes = configuration.financial_tree.classes;
      this.revenue_classes = configuration.financial_tree.revenues;
      this.expense_classes = configuration.financial_tree.expenses;

      this.route.queryParams.subscribe(params => {
        this.type = params['type'];
        let key = params['key'];
        this.title = (this.type === 'revenue') ? this.revenue_classes.find(c => c.key === key)?.description || '' : this.expense_classes.find(c => c.key === key)?.description || '';
        console.log("%s %s %s", this.type, key, this.title);
      });
    });


    this.bookService.list_book_entries$().subscribe((book_entries) => {
      this.book_entries = book_entries;
      this.build_arrays();

    });

  }
  build_arrays() {
    // this.bank_book_entries = this.book_entries.filter(book_entry => this.bank_accounts.some(op => book_entry.amounts[op] !== undefined));
    // this.cashbox_book_entries = this.book_entries.filter(book_entry => this.cashbox_accounts.some(op => book_entry.amounts[op] !== undefined));;
    this.revenues = this.bookService.get_revenues();
    this.expenses = this.bookService.get_expenses();
  }

  show_book_entry(id: string) {
  }
}
