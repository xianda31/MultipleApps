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

@Component({
  selector: 'app-balance',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, ParenthesisPipe],
  templateUrl: './balance.component.html',
  styleUrl: './balance.component.scss'
})
export class BalanceComponent {
  fileUrl: any;
  selected_season!: string;
  current_season!: string;
  trading_result = 0;
  loaded = false;
  balance_board!: Balance_board;
  balance_error: number = 0;


  truncature = '1.2-2';// '1.2-2';  //
  truncature2 = '1.2-2';// '1.2-2';  //

  constructor(
    private systemDataService: SystemDataService,
    private bookService: BookService,
    private toastService: ToastService,
    private fileService: FileService,
    private financialService: FinancialReportService,
    private router: Router,
  ) { }


  ngOnInit() {

    this.systemDataService.get_configuration().pipe(
      map((configuration) => {
        this.selected_season = configuration.season;
        this.current_season = configuration.season;
        return configuration.season;
      }),
      switchMap((season) => this.bookService.list_book_entries$(season)),
      switchMap(() => this.financialService.list_balance_sheets())
    ).subscribe((balance_sheets) => {
      this.fileUrl = this.fileService.json_to_blob(balance_sheets);
      this.balance_board = this.financialService.compute_balance_board(this.current_season);
      this.check_balance_vs_profit_and_loss();
      this.loaded = true;
    });
  }


  get cashbox_lines(): string[] {
    let lines: string[] = ['fond de caisse'];
    if (this.balance_board.current.client_debts !== 0) {
      lines.push('dettes clients');
    }
    // if (this.balance_board.current.client_assets !== 0) {
    //   lines.push('avoirs clients');
    // }

    return lines;
  }

  check_balance_vs_profit_and_loss() {
    this.trading_result = this.bookService.get_trading_result();
    this.balance_error = (this.balance_board.delta.actif_total - this.trading_result);
    if (this.balance_error !== 0) {
      console.log('incohérence entre résultat et bilan', this.balance_error, this.balance_board.delta.actif_total, this.trading_result);
      this.toastService.showWarningToast('consolidation financière', 'incohérence entre résultat et bilan');
    }
  }

  // cloture comptable : initialisation des reports financiers
  transfer_to_next_balance_sheet() {

    let current_season = this.balance_board.current.season;
    let next_season = this.systemDataService.next_season(current_season);

    this.bookService.generate_next_season_entries(next_season)
      .subscribe((nbr) => {
        this.toastService.showSuccessToast('cloture saison', nbr + 'écritures de report générées pour la saison ' + next_season);
        // finalisation  : passage à la nouvelle saison
        this.systemDataService.to_next_season();
      });
  }

  save_balance_sheet() {
    this.financialService.save_balance_sheet(this.balance_board.current).subscribe((result) => {
      this.toastService.showSuccessToast('sauvegarde bilan', 'sauvegarde du bilan effectuée avec succès');
    });
  }

  async file_import(event: any) {
    const file = event.target.files[0];
    this.financialService.import_balance_sheet(file);
  }

  show_details(account: 'gift_vouchers' | 'client_debts') {
    switch (account) {
      case 'gift_vouchers':
        this.router.navigate(['/details/assets']);
        break;
      case 'client_debts':
        this.router.navigate(['/details/debts']);
        break;
      default:
        console.error('Unknown account type:', account);
        break;
    }
  }

  download_file() {
    if (this.fileUrl) {
      const link = document.createElement('a');
      link.href = this.fileUrl;
      link.download = 'balance_sheet.json';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      console.error('No file URL available for download.');
    }
  }
}
