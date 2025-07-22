import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { SystemDataService } from '../../../../common/services/system-data.service';
import { ToastService } from '../../../../common/toaster/toast.service';
import { map, switchMap } from 'rxjs';
import { BookService } from '../book.service';
import { FileService } from '../../../../common/services/files.service';
import { ParenthesisPipe } from '../../../../common/pipes/parenthesis.pipe';
import { FinancialReportService } from '../financial_report.service';
import { Balance_board } from '../../../../common/balance.interface';
import { Router } from '@angular/router';
import { DebtsAndAssetsDetailsComponent } from "../books/details/debts-and-assets/debts-and-assets-details.component";

@Component({
  selector: 'app-balance',
  imports: [CommonModule, FormsModule, ReactiveFormsModule, ParenthesisPipe, DebtsAndAssetsDetailsComponent],
  templateUrl: './balance.component.html',
  styleUrl: './balance.component.scss'
})
export class BalanceComponent {

  export_url: any;
  selected_season!: string;
  current_season!: string;
  trading_result = 0;
  loaded = false;
  balance_board!: Balance_board;
  balance_error: number = 0;

  show_details_flag = false;
  due: 'dettes' | 'avoirs' = 'dettes';

  truncature = '1.2-2';// '1.0-0';  //
  // truncature2 = '1.2-2';// '1.2-2';  //

  constructor(
    private systemDataService: SystemDataService,
    private bookService: BookService,
    private toastService: ToastService,
    private financialService: FinancialReportService,
    private router: Router,
  ) { }


  ngOnInit() {

    this.systemDataService.get_configuration().subscribe(
      (configuration) => {
        this.selected_season = configuration.season;
        this.current_season = configuration.season;
        return configuration.season;
      });

      this.bookService.list_book_entries().pipe(
      switchMap(() => this.financialService.list_balance_sheets())
    ).subscribe((balance_sheets) => {
      this.balance_board = this.financialService.compute_balance_board(this.current_season);
      this.check_balance_vs_profit_and_loss();

      this.export_url = this.financialService.export_balance_sheets()
      this.loaded = true;
    });
  }



  check_balance_vs_profit_and_loss() {
    this.trading_result = this.bookService.get_trading_result();
    this.balance_error = this.Round(this.balance_board.delta.actif_total - this.trading_result);
    if (this.balance_error !== 0) {
      console.log('incohérence entre résultat et bilan', this.balance_error, this.balance_board.delta.actif_total, this.trading_result);
      this.toastService.showWarning('consolidation financière', 'incohérence entre résultat et bilan');

      // this.bookService.check_book_entries_loaded();
    }


  }

  // cloture comptable : initialisation des reports financiers
  transfer_to_next_balance_sheet() {

    let current_season = this.balance_board.current.season;
    let next_season = this.systemDataService.next_season(current_season);

    this.bookService.generate_next_season_entries(next_season)
      .subscribe((nbr) => {
        this.toastService.showSuccess('cloture saison', nbr + 'écritures de report générées pour la saison ' + next_season);
        // finalisation  : passage à la nouvelle saison
        this.systemDataService.change_to_new_season(next_season);
      });
  }

  save_balance_sheet() {
    this.financialService.save_balance_sheet(this.balance_board.current).subscribe((result) => {
      this.toastService.showSuccess('sauvegarde bilan', 'sauvegarde du bilan effectuée avec succès');
    });
  }

  async file_import(event: any) {
    const file = event.target.files[0];
    this.financialService.import_balance_sheets(file);
  }

  show_details(account: 'gift_vouchers' | 'client_debts' | 'commited_payments') {
    switch (account) {
      case 'gift_vouchers':
        this.show_details_flag = true;
        this.due = 'avoirs';
        break;
      case 'client_debts':
        this.show_details_flag = true;
        this.due = 'dettes';
        break;
      case 'commited_payments':
        this.router.navigate(['/finance/bank-reconciliation']);
        break;
      default:
        console.error('Unknown account type:', account);
        break;
    }
  }

  get trace_on() {
    return this.systemDataService.trace_on();
  }

  Round(value: number) {
    const neat = +(Math.abs(value).toPrecision(15));
    const rounded = Math.round(neat * 100) / 100;
    return rounded * Math.sign(value);
  }


  // private download_file() {

  //   if (this.export_url) {
  //     const link = document.createElement('a');

  //     link.href = this.export_url;
  //     link.download = 'balance_sheet.json';
  //     document.body.appendChild(link);
  //     link.click();
  //     document.body.removeChild(link);
  //   } else {
  //     console.error('No file URL available for download.');
  //   }
  // }
}
