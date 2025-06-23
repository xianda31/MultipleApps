import { Component } from '@angular/core';
import { Expense, BookEntry, FINANCIAL_ACCOUNT, Revenue, TRANSACTION_ID, Cashbox_accounts, Bank_accounts, Savings_accounts } from '../../../../../common/accounting.interface';
import { BookService } from '../../book.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SystemDataService } from '../../../../../common/services/system-data.service';
import { ActivatedRoute, Router } from '@angular/router';
import { TransactionService } from '../../transaction.service';
import { combineLatest, switchMap, tap } from 'rxjs';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { FinancialReportService } from '../../financial_report.service';
import { DebtsAndAssetsDetailsComponent } from "../details/debts-and-assets/debts-and-assets-details.component";
import { TruncatePipe } from '../../../../../common/pipes/truncate.pipe';

enum REPORTS {
  CHARGES = 'dépenses,charges',
  PRODUITS = 'recettes,produits',
  BANQUE = 'compte en banque',
  EPARGNE = 'épargne',
  DETTES_ET_CREDITS = 'dettes & crédits',
  CAISSE_CASH = 'espèces en caisse',
  CAISSE_CHEQUES = 'chèques à déposer',
  AVOIRS_ADHERENTS = 'avoirs adhérents',
}

enum CASHBOX_FILTER {
  CASH_ONLY = 'espèces seulement',
  CHEQUES_ONLY = 'chèques seulement',
}

interface Deposit_checked {
  ref: string;
  out_date?: string;
  cheques_nbr: number;
  amount: number;
  complete: boolean;
  balanced: boolean;
  entries: BookEntry[];
}

interface EntryValue { total: number, entries: BookEntry[] };
@Component({
  selector: 'app-books-overview',
  standalone: true,
  imports: [CommonModule, FormsModule, NgbModule, DebtsAndAssetsDetailsComponent, TruncatePipe],
  templateUrl: './books-overview.component.html',
  styleUrl: './books-overview.component.scss'
})
export class BooksOverviewComponent {
  truncature = '1.2-2';  // '1.0-0';// '1.2-2';  //
  SLICE_SIZE = 15;

  reports = Object(REPORTS)
  reports_values = Object.values(REPORTS);
  selected_report!: string; //= REPORTS.CAISSE;
  show_all_assets = false;


  expenses_accounts !: string[];
  products_accounts !: string[];

  revenues!: Revenue[];
  expenses: Expense[] = [];

  book_entries: BookEntry[] = [];


  cashbox_cash: BookEntry[] = [];
  cashbox_cheques: BookEntry[] = [];
  cashbox_filters = Object(CASHBOX_FILTER);
  cashbox_status: {
    cash: {
      amount: number;   // cash en caisse
      mouvements: number;   // cumul des mouvements de caisse
    },
    cheques: {      // chèques en caisse
      nbr: number;  // nombre de chèques en caisse
      amount: number; // montant total des chèques en caisse
      anomaly: boolean; // anomalie de dépôt
    };
  } = { cash: { amount: 0, mouvements: 0 }, cheques: { nbr: 0, amount: 0, anomaly: false } };

  cash_level: { date: string, value: number }[] = [];

  vouchers_amount: number = 0; // chèques cadeaux

  bank_book_entries: BookEntry[] = [];
  savings_book_entries: BookEntry[] = [];

  current_cash_movements: number = 0;
  current_bank_movements: number = 0;
  current_savings_movements: number = 0;
  current_assets_amount: number = 0;
  current_debt_amount: number = 0;
  current_expenses_operations_amount: number = 0;
  current_products_operations_amount: number = 0;

  initial_liquidities: { cash: number, bank: number, savings: number } = { cash: 0, bank: 0, savings: 0 };

  bank_accounts = Object.values(Bank_accounts) as FINANCIAL_ACCOUNT[];
  savings_accounts = Object.values(Savings_accounts) as FINANCIAL_ACCOUNT[];
  cashbox_accounts = Object.values(Cashbox_accounts) as FINANCIAL_ACCOUNT[];

  debts: Map<string, EntryValue> = new Map();
  assets: Map<string, EntryValue> = new Map();
  // assets_entries: { [key: string]: EntryValue } = {};

  slice_start = -this.SLICE_SIZE; // pour le slice des opérations

  constructor(
    private bookService: BookService,
    private transactionService: TransactionService,
    private systemDataService: SystemDataService,
    private financialService: FinancialReportService,
    private router: Router,
    private route: ActivatedRoute,
  ) { }

  ngOnInit() {
    this.route.params.subscribe(params => {
      let report = params['report'];
      if (report && Object.values(REPORTS).includes(report)) {
        this.selected_report = report;
      }
    });
    
    
    this.systemDataService.get_configuration().pipe(
      tap((conf) => {
        this.expenses_accounts = conf.revenue_and_expense_tree.expenses.map((account) => account.key);
        this.products_accounts = conf.revenue_and_expense_tree.revenues.map((account) => account.key);
      }),
      switchMap((conf) => {
        return combineLatest([
          this.financialService.read_balance_sheet(this.systemDataService.previous_season(conf.season)),
          this.bookService.list_book_entries$(conf.season)
        ]);
      }),
    ).subscribe(([prev_balance_sheet, book_entries]) => {
      this.initial_liquidities = {
        cash: prev_balance_sheet.cash,
        bank: prev_balance_sheet.bank,
        savings: prev_balance_sheet.savings,
      };
      this.book_entries = book_entries;

      this.bank_book_entries = this.book_entries.filter(book_entry => this.bank_accounts.some(op => book_entry.amounts[op] !== undefined));
      this.revenues = this.bookService.get_revenues();
      this.expenses = this.bookService.get_expenses();

      this.savings_book_entries = this.book_entries.filter(book_entry => this.savings_accounts.some(op => book_entry.amounts[op] !== undefined));

      this.current_cash_movements = this.bookService.get_cashbox_movements_amount('cash');
      this.current_bank_movements = this.bookService.get_bank_movements_amount();
      this.current_savings_movements = this.bookService.get_savings_movements_amount();

      this.debts = this.bookService.get_debts();
      this.assets = this.bookService.get_customers_assets();
      // this.assets_entries = Object.fromEntries(this.assets.entries());

      this.vouchers_amount = this.bookService.get_customers_assets_amount();

      this.current_debt_amount = this.debts.size > 0 ? Array.from(this.debts.values()).reduce((acc, debt) => acc + debt.total, 0) : 0;
      this.current_assets_amount = this.assets.size > 0 ? Array.from(this.assets.values()).reduce((acc, asset) => acc + asset.total, 0) : 0;

      this.current_expenses_operations_amount = this.bookService.get_total_expenses();
      this.current_products_operations_amount = this.bookService.get_total_revenues();

      this.manage_cheques_deposits(book_entries);

      this.cashbox_cash = book_entries.filter((book_entry) => this.transactionService.get_transaction(book_entry.transaction_id).cash !== 'none')
      this.cash_level = this.cash_flow();
      this.cashbox_status.cash.mouvements = this.bookService.get_cashbox_movements_amount('cash');

    });

  }

  toggle_slice() {
    this.slice_start = (this.slice_start === 0) ? -this.SLICE_SIZE : 0;
  }

  // utilitaires pour visualisation des chèques et leur status de dépôt

  cheques_deposits: Deposit_checked[] = [];

  manage_cheques_deposits(book_entries: BookEntry[] ) {

    let selectable = (id: TRANSACTION_ID): boolean => {
      return (id === TRANSACTION_ID.dépôt_caisse_chèques) 
      || (id === TRANSACTION_ID.achat_adhérent_par_chèque)
      || (id === TRANSACTION_ID.vente_par_chèque);
    }

    let cashbox_cheques = book_entries.filter((book_entry) =>      selectable(book_entry.transaction_id ))  ;

    this.cheques_deposits = this.sort_deposits(cashbox_cheques);

    this.cashbox_status.cheques.anomaly = this.cheques_deposits.some((chked_deposit) => !chked_deposit.balanced && chked_deposit.complete);;
    let outstanding_deposits = this.cheques_deposits.find((deposit: Deposit_checked) => deposit.out_date === undefined);

    if (outstanding_deposits) {
      this.cashbox_status.cheques.nbr = outstanding_deposits.cheques_nbr;
      this.cashbox_status.cheques.amount = outstanding_deposits.amount;
    };


  }

  sort_deposits(entries: BookEntry[]): Deposit_checked[] {

    const deposit_check = (ref: string, entries: BookEntry[]): Deposit_checked => {
      {
        let cheques_nbr = entries.filter((book_entry) => {
          return this.transactionService.get_transaction(book_entry.transaction_id).cheque === 'in';
        }).length;

        let debit = entries.reduce((acc, book_entry) => {
          return acc + this.Round(book_entry.amounts[FINANCIAL_ACCOUNT.CASHBOX_debit] || 0)
        }, 0);
        let credit = entries.reduce((acc, book_entry) => {
          return acc + this.Round(book_entry.amounts[FINANCIAL_ACCOUNT.CASHBOX_credit] || 0)
        }, 0);

        let out_entry = (entries.find((book_entry) => {
          return book_entry.transaction_id === TRANSACTION_ID.dépôt_caisse_chèques;
        }));
        let out_date = out_entry?.date ?? undefined;

        let result = { ref: ref, out_date: out_date, cheques_nbr: cheques_nbr, amount: debit, complete: (out_date !== undefined), balanced: (credit === debit) };
        return { ...result, entries };
      }
    }

    // group entries by deposit_ref
    let deposit_refs = new Map<string, BookEntry[]>();

    entries.forEach((book_entry) => {
      let deposit_ref = book_entry.deposit_ref ?? 'non déposé'; //.split('_')[0];
      if (!deposit_refs.has(deposit_ref)) {
        deposit_refs.set(deposit_ref, [book_entry]);
      } else {
        deposit_refs.get(deposit_ref)!.push(book_entry);
      }
    });

    // sort grouped entries by date
    let deposits: Deposit_checked[] = [];
    Array.from(deposit_refs.entries()).reverse().forEach(([ref, entries]) => {
      let check = deposit_check(ref, entries);
      deposits.push(check);
    });
    return deposits;
  }

  // utilitaires pour visualisation des espèces


  get cash_entries(): BookEntry[] {
    return this.book_entries.filter((book_entry) => this.transactionService.get_transaction(book_entry.transaction_id).cash !== 'none');
  }


  cash_flow(): { date: string, value: number }[] {
    let cash_level: { date: string, value: number }[] = [];
    let total_movement = 0
    // let cash_delta: number = 0;
    this.cashbox_cash.forEach((book_entry, index) => {
      let movement = (book_entry.amounts[FINANCIAL_ACCOUNT.CASHBOX_debit] || 0) - (book_entry.amounts[FINANCIAL_ACCOUNT.CASHBOX_credit] || 0)
      total_movement += movement;
      if (index === 0) {
        cash_level.push({ date: book_entry.date, value: this.Round(this.initial_liquidities.cash + movement) });
      } else {
        cash_level.push({ date: book_entry.date, value: this.Round(cash_level[index - 1].value + movement) });
      }
    });
    return cash_level;
    // console.log('cash movements', cash_delta);
  }



  // utilitaires pour visualisation des opérations

  transaction_label(op_type: TRANSACTION_ID): string {
    return this.transactionService.get_transaction(op_type).label;
  }

  Round(value: number) {
    const neat = +(Math.abs(value).toPrecision(15));
    const rounded = Math.round(neat * 100) / 100;
    return rounded * Math.sign(value);
  }

  delete_book_entry(book_entry: BookEntry) {
    try {
      this.bookService.delete_book_entry(book_entry)
    }
    catch (error) {
      console.error('Error deleting book entry:', error);
    };
  }

  show_book_entry(book_entry_id: string) {
    this.router.navigate(['/finance/books/editor', book_entry_id]);
  }

  show(selection: string) {
    let id = selection.split(' : ')[1];
    this.router.navigate(['/finance/books/editor', id]);
  }

  go_report(report: string) {
    if (report === this.selected_report) {
      this.selected_report = '';
    } else {
      this.selected_report = report;
    }

  }
}
