import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { SystemDataService } from '../../../../common/services/system-data.service';
import { ToastService } from '../../../../common/toaster/toast.service';
import { BALANCE_ACCOUNT, Balance_sheet, BOOK_ENTRY_CLASS, BookEntry, CUSTOMER_ACCOUNT, ENTRY_TYPE, FINANCIAL_ACCOUNT, Liquidity, Operation, operation_values } from '../../../../common/accounting.interface';
import { combineLatest, forkJoin, switchMap, tap } from 'rxjs';
import { BookService } from '../book.service';
import { FileService } from '../../../../common/services/files.service';
import { get_transaction } from '../../../../common/transaction.definition';

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
  profit_and_loss_result = 0;
  loaded = false;
  balance_sheets: Balance_sheet[] = [];
  current_balance_sheet !: Balance_sheet;
  prev_balance_sheet !: Balance_sheet;
  balance_forward: number = 0;
  book_entries: BookEntry[] = [];
  // liquidities_evolution = 0;


  truncature = '1.0-0';// '1.2-2';  //

  constructor(
    private systemDataService: SystemDataService,
    private bookService: BookService,
    private toatService: ToastService,
    private fileService: FileService
  ) { }

  get_liquidity_evolution(liquidity: Liquidity): string {
    const current = this.current_balance_sheet.liquidities[liquidity] ?? 0;
    const previous = this.prev_balance_sheet.liquidities[liquidity] ?? 0;
    const diff = current - previous;
    return diff > 0 ? '+' + diff : diff < 0 ? diff.toString() : '';
  }
  total_current_liquidities() {
    return this.current_balance_sheet.liquidities.cash + this.current_balance_sheet.liquidities.bank + this.current_balance_sheet.liquidities.savings;
  }
  total_previous_liquidities() {
    return this.prev_balance_sheet.liquidities.cash + this.prev_balance_sheet.liquidities.bank + this.prev_balance_sheet.liquidities.savings;
  }
  get_liquidities_evolution() {
    let diff = this.total_current_liquidities() - this.total_previous_liquidities();
    return diff > 0 ? '+' + diff : diff < 0 ? diff.toString() : '';
  }

  total_current_outstandings() {
    return -(+this.current_balance_sheet.outstanding_expenses + this.current_balance_sheet.gift_vouchers);
  }
  total_previous_outstandings() {
    return -(+this.prev_balance_sheet.outstanding_expenses + this.prev_balance_sheet.gift_vouchers);
  }
  get_outstandings_evolution() {
    let diff = this.total_current_outstandings() - this.total_previous_outstandings();
    return diff > 0 ? '+' + diff : diff < 0 ? diff.toString() : '';
  }

  total_current_net_asset() {
    return this.net_asset_total(this.current_balance_sheet);
  }
  total_previous_net_asset() {
    return this.net_asset_total(this.prev_balance_sheet);
  }
  net_asset_total(balance_sheet: Balance_sheet) {
    return balance_sheet.stock + balance_sheet.client_debts + balance_sheet.liquidities.cash + balance_sheet.liquidities.bank + balance_sheet.liquidities.savings - (+balance_sheet.outstanding_expenses + balance_sheet.gift_vouchers);
  }

  get_net_asset_evolution() {
    let diff = this.total_current_net_asset() - this.total_previous_net_asset();
    return diff > 0 ? '+' + diff : diff < 0 ? diff.toString() : '';
  }

  get_total_current_liabilities() {
    return this.net_asset_total(this.prev_balance_sheet) + this.profit_and_loss_result;
  }

  update_balance_sheet_figures() {
    if (this.current_season !== this.selected_season) {
      throw new Error('saison courante différente de la saison sélectionnée');
    }
    let cashbox_movements = this.bookService.get_cashbox_movements_amount();
    let bank_movements = this.bookService.get_bank_movements_amount();
    let savings_movements = this.bookService.get_savings_movements_amount();
    let bank_outstanding_expenses = this.bookService.get_bank_outstanding_expenses();
    let gift_vouchers = this.bookService.get_customers_assets_amount();
    let client_debts = this.bookService.get_clients_debit_value();

    this.current_balance_sheet.liquidities.cash = this.prev_balance_sheet.liquidities.cash + cashbox_movements;
    this.current_balance_sheet.liquidities.bank = this.prev_balance_sheet.liquidities.bank + bank_movements;
    this.current_balance_sheet.liquidities.savings = this.prev_balance_sheet.liquidities.savings + savings_movements;
    this.current_balance_sheet.outstanding_expenses = bank_outstanding_expenses;
    this.current_balance_sheet.gift_vouchers = gift_vouchers;
    this.current_balance_sheet.client_debts = client_debts;

    this.balance_forward = this.net_asset_total(this.prev_balance_sheet);
    this.profit_and_loss_result = this.net_asset_total(this.current_balance_sheet) - this.balance_forward;

  }


  test_nbr: number = 0;
  ngOnInit() {

    combineLatest([
      this.systemDataService.get_configuration(),
      this.systemDataService.get_balance_history(),
    ])
      .subscribe(([conf, balance_sheets]) => {
        this.selected_season = conf.season;
        this.current_season = conf.season;
        this.balance_sheets = balance_sheets.sort((a, b) => b.season.localeCompare(a.season));
        this.seasons = this.balance_sheets.map((sheet) => sheet.season);
        this.select_sheet();
        this.bookService.list_book_entries$(conf.season).subscribe((entries) => {
          this.book_entries = entries;
          this.update_balance_sheet_figures();
          this.loaded = true;

        });

      });

  }

  previous_season(season: string) {
    return (+season.slice(0, 4) - 1).toString() + '-' + (+season.slice(0, 4)).toString();
  }

  select_sheet() {
    this.current_balance_sheet = this.balance_sheets.find((sheet) => sheet.season === this.selected_season) ?? this.create_balance_sheet(this.selected_season);
    this.prev_balance_sheet = this.balance_sheets.find((sheet) => sheet.season === this.previous_season(this.selected_season)) ?? this.create_balance_sheet(this.previous_season(this.previous_season(this.selected_season)));

    this.fileUrl = this.fileService.get_file_url(this.balance_sheets);
    // this.other_seasons = this.seasons.filter((season) => season !== this.selected_season);
  }

  create_balance_sheet(season: string) {
    let new_balance_sheet: Balance_sheet = {
      season: season,
      stock: 0,
      client_debts: 0,
      liquidities: { cash: 0, bank: 0, savings: 0 },
      outstanding_expenses: 0,
      gift_vouchers: 0
    };
    this.balance_sheets.push(new_balance_sheet);
    this.seasons = this.balance_sheets.map((sheet) => sheet.season);

    return new_balance_sheet;
  }


  save_balance_sheets() {
    console.log('save_balance_sheets', this.balance_sheets);
    this.systemDataService.save_balance_history(this.balance_sheets);
  }

  async onInput(event: any) {
    const file = event.target.files[0];
    if (file) {
      const text = await file.text();
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
  to_next_balance_sheet() {

    let next_season = this.systemDataService.next_season(this.selected_season);
    let next_season_entries: BookEntry[] = [];

    // 0. raz eventuelles données pré-existantes

    this.bookService.clear_book_entries$(next_season);



    // A. report des avoirs client
    let assets = this.bookService.get_customers_assets();
    {
      let operations: Operation[] = [];
      let total = 0;

      Array.from(assets)
        .filter(([member, { total, entries }]: [string, { total: number; entries: BookEntry[] }]) => total > 0)
        .forEach(([member, { total, entries }]: [string, { total: number; entries: BookEntry[] }]) => {
          operations.push({ member: member, label: 'report avoir antérieur', values: { [CUSTOMER_ACCOUNT.ASSET_credit]: total } });
          total += total;
        }
        );


      let book_entry: BookEntry = {
        id: '',
        season: next_season,
        date: this.systemDataService.closout_date(this.selected_season),
        class: BOOK_ENTRY_CLASS.f_BALANCE_SHEET,
        bank_op_type: ENTRY_TYPE.asset_forwarding,
        amounts: { [BALANCE_ACCOUNT.BAL_debit]: total },
        operations: operations,
      };

      console.log('report d\'avoir', book_entry);
      next_season_entries.push(book_entry);

    }

    // B. report des chèques non encaissés
    this.book_entries.filter((entry) => ((entry.bank_op_type === ENTRY_TYPE.cheque_forwarding) || (entry.bank_op_type === ENTRY_TYPE.cheque_emit)) && entry.bank_report === null)
      .forEach((entry) => {
        let amount = entry.amounts[FINANCIAL_ACCOUNT.BANK_credit];
        if (!amount) throw Error('montant du chèque non défini !?!?')
        let label = entry.operations.reduce((acc, op) => { return acc + op.label + ' ' }, entry.date.toString() + ':');;

        let book_entry: BookEntry = {
          id: '',
          season: next_season,
          date: this.systemDataService.closout_date(this.selected_season),
          class: BOOK_ENTRY_CLASS.f_BALANCE_SHEET,
          bank_op_type: ENTRY_TYPE.cheque_forwarding,
          amounts: { [FINANCIAL_ACCOUNT.BANK_credit]: amount },
          cheque_ref: entry.cheque_ref,
          operations: [{ label: label, values: { [BALANCE_ACCOUNT.BAL_debit]: amount } }],
        }

        // console.log('report des chèque', book_entry);
        next_season_entries.push(book_entry);

      });

    // C. report des dettes clients
    {
      let debts = this.bookService.get_debts();
      let operations: Operation[] = [];
      let total = 0;
      Array.from(debts)
        .filter(([member, value]: [string, number]) => value > 0)
        .forEach(([member, value]: [string, number]) => {
          total += value;
          operations.push({ member: member, label: 'report dette', values: { [CUSTOMER_ACCOUNT.DEBT_debit]: value } });
        });

      let book_entry: BookEntry = {
        id: '',
        season: next_season,
        date: this.systemDataService.closout_date(this.selected_season),
        class: BOOK_ENTRY_CLASS.f_BALANCE_SHEET,
        bank_op_type: ENTRY_TYPE.debt_forwarding,
        amounts: { [BALANCE_ACCOUNT.BAL_credit]: total },
        operations: operations,
      };

      // console.log('report de dettes', book_entry);
      next_season_entries.push(book_entry);
    }

    // écriture next_entries
    const promises = next_season_entries.map((entry) => this.bookService.create_book_entry(entry));
    forkJoin(promises).subscribe((results) => {
      this.toatService.showSuccessToast('cloture saison', 'dettes, avoir et chèques non encaissées ont été reportés');
    }
    );

    // finalisation  : passage à la nouvelle saison
    this.systemDataService.to_next_season();
  }

}
