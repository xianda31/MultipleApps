import { Component } from '@angular/core';
import { SystemDataService } from '../../../../common/services/system-data.service';
import { ToastService } from '../../../../common/toaster/toast.service';
import { BookService } from '../book.service';
import { Sub_class } from '../../../../common/system-conf.interface';
import { CommonModule } from '@angular/common';
import { Revenue } from '../../../../common/accounting.interface';

@Component({
  selector: 'app-profit-and-loss',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './profit-and-loss.component.html',
  styleUrl: './profit-and-loss.component.scss'
})
export class ProfitAndLossComponent {

  p_and_l_classes: { key: string, description: string }[] = [];
  revenue_classes: Sub_class[] = [];
  expense_classes: Sub_class[] = [];

  revenues: Revenue[] = [];
  expenses: Revenue[] = [];


  constructor(
    private systemDataService: SystemDataService,
    private bookService: BookService,
    private toatService: ToastService,
  ) {
  }



  ngOnInit(): void {
    this.systemDataService.get_configuration().subscribe((configuration) => {
      this.bookService.list_book_entries$(configuration.season).subscribe(() => {
        this.revenues = this.bookService.get_revenues();
        this.expenses = this.bookService.get_expenses();

        this.p_and_l_classes = configuration.financial_tree.classes;
        this.revenue_classes = configuration.financial_tree.revenues;
        this.expense_classes = configuration.financial_tree.expenses;

        console.log('expenses:', this.expenses);
      });


    });

  }
  get_total_revenues(key?: string): number {
    return this.bookService.get_total_revenues(key);
  }
  get_total_expenses(key?: string): number {
    return this.bookService.get_total_expenses(key);
  }
  get_profit_and_loss_result(): number {
    return this.bookService.get_profit_and_loss_result();
  }

}
