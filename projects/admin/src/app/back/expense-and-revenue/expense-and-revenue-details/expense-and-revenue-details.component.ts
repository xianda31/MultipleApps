import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Revenue_and_expense_definition } from '../../../common/interfaces/system-conf.interface';
import { CommonModule, Location } from '@angular/common';
import { SystemDataService } from '../../../common/services/system-data.service';
import { BookService } from '../../services/book.service';
import { Revenue, Expense } from '../../../common/interfaces/accounting.interface';
import { combineLatest, tap, switchMap } from 'rxjs';
import { BackNavigationService } from '../../services/back-navigation.service';
import { BackComponent } from '../../../common/loc-back/loc-back.component';


@Component({
  selector: 'app-expense-and-revenue-details',
  standalone: true,
    imports: [CommonModule, BackComponent],
    templateUrl: './expense-and-revenue-details.component.html',
    styleUrl: './expense-and-revenue-details.component.scss'
})
export class ExpenseAndRevenueDetailsComponent {
  key: string = '';
  type: string = '';
  title: string = ''

  p_and_l_sections: { key: string, description: string }[] = [];
  revenue_definitions: Revenue_and_expense_definition[] = [];
  expense_definitions: Revenue_and_expense_definition[] = [];
  total_amount = 0;

  expenses_accounts !: string[];
  products_accounts !: string[];

  revenues: Revenue[] = [];
  expenses: Expense[] = [];

  truncature = '1.2-2';  //'1.0-0';// 

  constructor(
    private route: ActivatedRoute,
    private bookService: BookService,
    private systemDataService: SystemDataService,
    private location: Location,
    private backNavigationService: BackNavigationService
  ) { }

  ngOnInit(): void {

    this.systemDataService.get_configuration().pipe(
      tap((conf) => {
        this.expenses_accounts = conf.revenue_and_expense_tree.expenses.map((account) => account.key);
        this.products_accounts = conf.revenue_and_expense_tree.revenues.map((account) => account.key);
        this.p_and_l_sections = conf.revenue_and_expense_tree.sections;
        this.revenue_definitions = conf.revenue_and_expense_tree.revenues;
        this.expense_definitions = conf.revenue_and_expense_tree.expenses
      }),
      switchMap((conf) => combineLatest([this.route.queryParams, this.bookService.list_book_entries()]))
    )
      .subscribe(([params, book_entries]) => {


        this.type = params['type'];
        this.key = params['key'];


        if (this.type === 'revenue') {
          this.title = this.revenue_definitions.find(c => c.key === this.key)?.description || '';
          this.revenues = this.bookService.get_revenues().filter(revenue => Object.keys(revenue.values).includes(this.key));
          this.total_amount = this.revenues.reduce((acc, revenue) => acc + (revenue.values[this.key] || 0), 0);
        } else if (this.type === 'expense') {
          this.title = this.expense_definitions.find(c => c.key === this.key)?.description || '';
          this.expenses = this.bookService.get_expenses().filter(expense => Object.keys(expense.values).includes(this.key));;
          this.total_amount = this.expenses.reduce((acc, expense) => acc + (expense.values[this.key] || 0), 0);
        }

      });

  }


  show_book_entry(book_entry_id: string) {
    this.backNavigationService.goToBooksEditorFull(book_entry_id);
  }

  back_to_parent_page() {
    this.location.back();
  }
}
