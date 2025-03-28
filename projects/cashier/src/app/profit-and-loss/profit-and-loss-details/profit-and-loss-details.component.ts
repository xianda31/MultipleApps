import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Sub_class } from '../../../../../common/system-conf.interface';
import { CommonModule } from '@angular/common';
import { SystemDataService } from '../../../../../common/services/system-data.service';
import { BookService } from '../../book.service';
import { Revenue, Expense, BookEntry } from '../../../../../common/accounting.interface';
import { combineLatest, tap, switchMap } from 'rxjs';
import { Router } from '@angular/router';


@Component({
  selector: 'app-profit-and-loss-details',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './profit-and-loss-details.component.html',
  styleUrl: './profit-and-loss-details.component.scss'
})
export class ProfitAndLossDetailsComponent {
  key: string = '';
  type: string = '';
  title: string = ''

  p_and_l_classes: { key: string, description: string }[] = [];
  revenue_classes: Sub_class[] = [];
  expense_classes: Sub_class[] = [];

  expenses_accounts !: string[];
  products_accounts !: string[];

  revenues: Revenue[] = [];
  expenses: Expense[] = [];

  constructor(
    private route: ActivatedRoute,
    private bookService: BookService,
    private systemDataService: SystemDataService,
    private router: Router,

  ) { }

  ngOnInit(): void {

    this.systemDataService.get_configuration().pipe(
      tap((conf) => {
        this.expenses_accounts = conf.financial_tree.expenses.map((account) => account.key);
        this.products_accounts = conf.financial_tree.revenues.map((account) => account.key);
        this.p_and_l_classes = conf.financial_tree.classes;
        this.revenue_classes = conf.financial_tree.revenues;
        this.expense_classes = conf.financial_tree.expenses
      }),
      switchMap((conf) => combineLatest([this.route.queryParams, this.bookService.list_book_entries$(conf.season)]))
    )
      .subscribe(([params, book_entries]) => {


        this.type = params['type'];
        this.key = params['key'];


        if (this.type === 'revenue') {
          this.title = this.revenue_classes.find(c => c.key === this.key)?.description || '';
          this.revenues = this.bookService.get_revenues().filter(revenue => Object.keys(revenue.values).includes(this.key));
        } else if (this.type === 'expense') {
          this.title = this.expense_classes.find(c => c.key === this.key)?.description || '';
          this.expenses = this.bookService.get_expenses().filter(expense => Object.keys(expense.values).includes(this.key));;
        }

      });

  }


  show_book_entry(book_entry_id: string) {
    this.router.navigate(['/books/editor', book_entry_id]);
  }
}
