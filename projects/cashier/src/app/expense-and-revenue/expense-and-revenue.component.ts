import { Component } from '@angular/core';
import { SystemDataService } from '../../../../common/services/system-data.service';
import { ToastService } from '../../../../common/toaster/toast.service';
import { BookService } from '../book.service';
import { Revenue_and_expense_definition } from '../../../../common/system-conf.interface';
import { CommonModule } from '@angular/common';
import { Revenue } from '../../../../common/accounting.interface';
import { Router } from '@angular/router';
import { switchMap, tap } from 'rxjs';


@Component({
  selector: 'app-expense-and-revenue',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './expense-and-revenue.component.html',
  styleUrl: './expense-and-revenue.component.scss'
})
export class ExpenseAndRevenueComponent {

  p_and_l_sections: { key: string, description: string }[] = [];
  revenue_definitions: Revenue_and_expense_definition[] = [];
  expense_definitions: Revenue_and_expense_definition[] = [];
  loaded: boolean = false;
  revenues!: Revenue[] ;
  expenses!: Revenue[] ;

  truncature = '1.2-2';// '1.2-2';  //


  constructor(
    private systemDataService: SystemDataService,
    private bookService: BookService,
    private router: Router,
    private toatService: ToastService,
  ) {
  }

  ngOnInit(): void {

    this.systemDataService.get_configuration().pipe(
      tap((configuration) => {
        if (!configuration) {
          this.toatService.showWarningToast('Configuration not found', 'Please check the configuration of the system');
        }
        this.p_and_l_sections = configuration.revenue_and_expense_tree.sections;
        this.revenue_definitions = configuration.revenue_and_expense_tree.revenues;
        this.expense_definitions = configuration.revenue_and_expense_tree.expenses;
      }),
      switchMap((configuration) => this.bookService.list_book_entries$(configuration.season))
    ).subscribe((entries) => {
      this.revenues = this.bookService.get_revenues();
      this.expenses = this.bookService.get_expenses();
      this.loaded = true;
    });

  }

get_total_revenues(key ?: string): number {
  return this.bookService.get_total_revenues(key);
}
get_total_expenses(key ?: string): number {
  return this.bookService.get_total_expenses(key);
}
get_trading_result(): number {
  return this.bookService.get_trading_result();
}

show_details(expense_or_revenue: 'expense' | 'revenue', key: string) {
  this.router.navigate(['/expense-and-revenue/details'], { queryParams: { type: expense_or_revenue, key: key } });
}
  // show_details_extended(event: MouseEvent, expense_or_revenue: 'expense' | 'revenue', key: string) {
  //   console.log('key pressed', event)
  // }


}
