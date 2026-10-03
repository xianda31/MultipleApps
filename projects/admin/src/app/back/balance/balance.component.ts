import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { SystemDataService } from '../../common/services/system-data.service';
import { ToastService } from '../../common/services/toast.service';
import { finalize, from, switchMap } from 'rxjs';
import { BookService } from '../services/book.service';
import { ParenthesisPipe } from '../../common/pipes/parenthesis.pipe';
import { Balance_board } from '../../common/interfaces/balance.interface';
import { Router } from '@angular/router';
import { BackNavigationService } from '../services/back-navigation.service';
import { DebtsAndAssetsDetailsComponent } from "../books/details/debts-and-assets/debts-and-assets-details.component";
import { FinancialReportService } from '../services/financial_report.service';
import { BookEntry } from '../../common/interfaces/accounting.interface';
import { GroupService } from '../../common/authentification/group.service';
import { Group_priorities } from '../../common/authentification/group.interface';

@Component({
  selector: 'app-balance',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, NgbModule, ParenthesisPipe, DebtsAndAssetsDetailsComponent],
  templateUrl: './balance.component.html',
  styleUrl: './balance.component.scss'
})
export class BalanceComponent {
  isMobile = false;

  export_url: any;
  selected_season!: string;
  current_season!: string;
  next_season!: string;
  trading_result = 0;
  loaded = false;
  balance_board!: Balance_board;
  balance_error: number = 0;
  unbalanced_entries: { entry: BookEntry, error: number }[] = [];
  unpointed_transfer_settlements: BookEntry[] = [];
  can_close_season = false;
  closing_season = false;

  show_details_flag = false;
  due: 'dettes' | 'avoirs' = 'dettes';

  truncature = '1.2-2';// '1.0-0';  //
  // truncature2 = '1.2-2';// '1.2-2';  //
  private _skip_next_check = false;

  constructor(
    private systemDataService: SystemDataService,
    private bookService: BookService,
    private toastService: ToastService,
    private financialService: FinancialReportService,
    private backNavigationService: BackNavigationService,
    private groupService: GroupService,
  ) {
    this.isMobile = window.innerWidth < 768;
    window.addEventListener('resize', () => {
      this.isMobile = window.innerWidth < 768;
    });
  }


  ngOnInit() {

    this.groupService.getUserAccreditation()
      .then(accreditation => this.can_close_season = accreditation.level >= Group_priorities.Administrateur)
      .catch(() => this.can_close_season = false);

    this.systemDataService.get_configuration().subscribe(
      (configuration) => {
        if (this.current_season && configuration.season !== this.current_season) {
          this.loaded = false; // transition de saison : bloquer le check jusqu'au rechargement complet
          this._skip_next_check = true; // ignorer la première vérification après le changement
        }
        this.selected_season = configuration.season!;
        this.current_season = configuration.season!;
        this.next_season = this.systemDataService.next_season(this.current_season);

        return configuration.season;
      });

    this.bookService.list_book_entries().pipe(
      switchMap(() => this.financialService.list_balance_sheets())
    ).subscribe((balance_sheets) => {
      this.balance_board = this.financialService.compute_balance_board(this.current_season);
      this.export_url = this.financialService.export_balance_sheets();
      this.loaded = true;
      this.check_balance_vs_profit_and_loss();
      this.unpointed_transfer_settlements = this.bookService.get_unpointed_transfer_settlements();
    });
  }



  check_balance_vs_profit_and_loss() {
    this.trading_result = this.bookService.get_trading_result();
    this.unbalanced_entries = this.bookService.get_unbalanced_book_entries();
    const balanceDeltaCents = this.toCents(this.balance_board.delta.actif_total);
    const tradingResultCents = this.toCents(this.trading_result);
    const diffCents = balanceDeltaCents - tradingResultCents;

    this.balance_error = diffCents / 100;
    if (!this.loaded) return;
    if (this._skip_next_check) {
      this._skip_next_check = false;
      return; // première vérification après changement de saison : pas de fausse alerte
    }

    // Ignore float noise: only warn when discrepancy is strictly above 1 cent.
    if (Math.abs(diffCents) > 1) {
      console.log('incohérence entre résultat et bilan', this.balance_error, this.balance_board.delta.actif_total, this.trading_result);
      this.toastService.showWarning('consolidation financière', 'incohérence entre résultat et bilan');
    }
  }

  // cloture comptable : initialisation des reports financiers
  close_and_open_next_season() {
    if (!this.can_close_season || this.balance_error || this.unbalanced_entries.length
      || this.unpointed_transfer_settlements.length || this.closing_season) {
      return;
    }

    const current_season = this.balance_board.current.season;
    const next_season = this.systemDataService.next_season(current_season);
    let generated_entries = 0;
    this.closing_season = true;

    this.financialService.save_balance_sheet(this.balance_board.current).pipe(
      switchMap(() => this.bookService.generate_next_season_entries(next_season)),
      switchMap((nbr) => {
        generated_entries = nbr;
        return from(this.systemDataService.change_to_new_season(next_season));
      }),
      finalize(() => this.closing_season = false)
    ).subscribe({
      next: () => this.toastService.showSuccess(
        'clôture saison',
        `${current_season} clôturée et ${next_season} ouverte (${generated_entries} écritures de report générées)`
      ),
      error: (error) => {
        console.error('Unable to close accounting season', error);
        this.toastService.showError('clôture saison', error?.message || 'La clôture a échoué');
      },
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
        this.backNavigationService.goToBankReconciliation();
        break;
      default:
        console.error('Unknown account type:', account);
        break;
    }
  }

  show_book_entry(book_entry_id: string) {
    this.backNavigationService.goToBooksEditorFull(book_entry_id);
  }

  get trace_on() {
    return this.systemDataService.trace_on();
  }

  Round(value: number) {
    const neat = +(Math.abs(value).toPrecision(15));
    const rounded = Math.round(neat * 100) / 100;
    return rounded * Math.sign(value);
  }

  private toCents(value: number): number {
    const neat = +(Math.abs(value).toPrecision(15));
    return Math.round(neat * 100) * Math.sign(value);
  }

}
