import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { SystemDataService } from '../../../../common/services/system-data.service';
import { ToastService } from '../../../../common/toaster/toast.service';
import { Balance_sheet, Liquidity } from '../../../../common/accounting.interface';
import { switchMap, tap } from 'rxjs';
import { BookService } from '../book.service';

@Component({
  selector: 'app-balance',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './balance.component.html',
  styleUrl: './balance.component.scss'
})
export class BalanceComponent {
  fileUrl: any;
  selected_season!: string;
  current_season!: string;
  seasons: string[] = [];
  // other_seasons: string[] = [];
  loaded = false;
  deficit = false;
  profit_and_loss_result = 0;

  balance_sheets: Balance_sheet[] = [];
  current_balance_sheet !: Balance_sheet;
  prev_balance_sheet !: Balance_sheet;
  liquidities_evolution = 0;

  nbr_trunc = '1.2-2';  //'1.0-0';

  constructor(
    private systemDataService: SystemDataService,
    private bookService: BookService,
    private toatService: ToastService,
  ) { }

  get_liquidity_evolution(liquidity: Liquidity): string {
    const currentAssets = this.current_balance_sheet.assets.liquidities[liquidity] ?? 0;
    const previousAssets = this.prev_balance_sheet.assets.liquidities[liquidity] ?? 0;
    const diff = currentAssets - previousAssets;
    return diff > 0 ? '+' + diff : diff < 0 ? diff.toString() : '';
  }
  total_current_liquidities() {
    return this.current_balance_sheet.assets.liquidities.cash + this.current_balance_sheet.assets.liquidities.bank + this.current_balance_sheet.assets.liquidities.savings;
  }
  total_previous_liquidities() {
    return this.prev_balance_sheet.assets.liquidities.cash + this.prev_balance_sheet.assets.liquidities.bank + this.prev_balance_sheet.assets.liquidities.savings;
  }
  get_liquidities_evolution() {
    let diff = this.total_current_liquidities() - this.total_previous_liquidities();
    return diff > 0 ? '+' + diff : diff < 0 ? diff.toString() : '';
  }

  total_current_assets() {
    return this.current_balance_sheet.assets.receivables + this.current_balance_sheet.assets.stock + this.total_current_liquidities();
  }
  total_previous_assets() {
    return this.prev_balance_sheet.assets.receivables + this.prev_balance_sheet.assets.stock + this.total_previous_liquidities();
  }
  get_assets_evolution() {
    let diff = this.total_current_assets() - this.total_previous_assets();
    return diff > 0 ? '+' + diff : diff < 0 ? diff.toString() : '';
  }

  get_total_current_liabilities() {
    return this.current_balance_sheet.liabilities.accrued_expenses + this.current_balance_sheet.liabilities.balance_forward + this.profit_and_loss_result;
  }

  update_balance_sheet_figures() {
    if (this.current_season !== this.selected_season) {
      throw new Error('saison courante différente de la saison sélectionnée');
    }
    let cashbox_movements = this.bookService.get_cashbox_movements_amount();
    let bank_movements = this.bookService.get_bank_movements_amount();
    let savings_movements = this.bookService.get_savings_movements_amount();
    this.liquidities_evolution = cashbox_movements + bank_movements + savings_movements;;
    let bank_accrued_expenses = this.bookService.get_bank_accrued_expenses();
    this.current_balance_sheet.assets.liquidities.cash = this.prev_balance_sheet.assets.liquidities.cash + cashbox_movements;
    this.current_balance_sheet.assets.liquidities.bank = this.prev_balance_sheet.assets.liquidities.bank + bank_movements;
    this.current_balance_sheet.assets.liquidities.savings = this.prev_balance_sheet.assets.liquidities.savings + savings_movements;
    this.current_balance_sheet.liabilities.balance_forward = this.assets_total(this.prev_balance_sheet);
    this.current_balance_sheet.liabilities.accrued_expenses = bank_accrued_expenses;
  }

  assets_total(balance_sheet: Balance_sheet) {
    return balance_sheet.assets.receivables + balance_sheet.assets.stock + balance_sheet.assets.liquidities.cash + balance_sheet.assets.liquidities.bank + balance_sheet.assets.liquidities.savings;
  }

  ngOnInit() {

    this.systemDataService.get_configuration().pipe(
      tap((conf) => {
        this.selected_season = conf.season;
        this.current_season = conf.season;
      }),
      switchMap((conf) => this.systemDataService.get_balance_history()))
      .subscribe((balance_sheets) => {
        this.balance_sheets = balance_sheets.sort((a, b) => b.season.localeCompare(a.season));
        console.log('balance_sheets', this.balance_sheets);
        this.seasons = this.balance_sheets.map((sheet) => sheet.season);
        this.select_sheet();
        this.update_balance_sheet_figures();
        this.loaded = true;
      });
    this.bookService.list_book_entries$().subscribe(() => {
      this.profit_and_loss_result = this.bookService.get_profit_and_loss_result();
      this.deficit = this.profit_and_loss_result < 0;
    });
  }


  previous_season(season: string) {
    return (+season.slice(0, 4) - 1).toString() + '-' + (+season.slice(0, 4)).toString();
  }

  select_sheet() {
    this.current_balance_sheet = this.balance_sheets.find((sheet) => sheet.season === this.selected_season) ?? { season: '', assets: { receivables: 0, stock: 0, liquidities: { cash: 0, bank: 0, savings: 0 } }, liabilities: { accrued_expenses: 0, balance_forward: 0 } };
    this.prev_balance_sheet = this.balance_sheets.find((sheet) => sheet.season === this.previous_season(this.selected_season)) ?? { season: '', assets: { receivables: 0, stock: 0, liquidities: { cash: 0, bank: 0, savings: 0 } }, liabilities: { accrued_expenses: 0, balance_forward: 0 } };
    this.fileUrl = this.systemDataService.get_file_url(this.balance_sheets);
    // this.other_seasons = this.seasons.filter((season) => season !== this.selected_season);
  }


  save_balance_sheets() {
    console.log('save_balance_sheets', this.balance_sheets);
    this.systemDataService.save_balance_history(this.balance_sheets);
  }


  async onInput(event: any) {
    const file = event.target.files[0];
    if (file) {
      const text = await file.text();
      // console.log('text', text);
      try {

        this.balance_sheets = JSON.parse(text);
        this.select_sheet();
        this.toatService.showSuccessToast('fichier de configuration chargé', 'les données sont prêtes à être enregistrées');
      } catch (error) {
        console.error('error', error);
        this.toatService.showErrorToast('erreur chargement fichier de configuration', 'vérifiez la syntaxe');
      }
    }

  }
}
