import { Component, computed, signal } from '@angular/core';
import { Expense, BookEntry, FINANCIAL_ACCOUNT, Revenue, TRANSACTION_ID, Cashbox_accounts, Bank_accounts, Liquidities } from '../../../../../common/accounting.interface';
import { BookService } from '../../book.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SystemDataService } from '../../../../../common/services/system-data.service';
import { Router } from '@angular/router';
import { TransactionService } from '../../transaction.service';
import { combineLatest, Observable, switchMap, tap } from 'rxjs';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { CashGraphComponent } from "../graphs/cash-graph/cash-graph.component";

enum REPORTS {
  PRODUITS = 'compte produits',
  CHARGES = 'compte de charges',
  BANQUE = 'compte en banque',
  CAISSE = 'caisse',
  DETTES_ET_AVOIRS = 'dettes et avoirs',
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
  imports: [CommonModule, FormsModule, NgbModule, CashGraphComponent],
  templateUrl: './books-overview.component.html',
  styleUrl: './books-overview.component.scss'
})
export class BooksOverviewComponent {
  truncature = '1.2-2';  // '1.0-0';// '1.2-2';  //

  reports = Object(REPORTS)
  selected_report!: string ; //= REPORTS.CAISSE;
  show_all_assets = false;


  expenses_accounts !: string[];
  products_accounts !: string[];

  revenues!: Revenue[];
  expenses: Expense[] = [];

  book_entries: BookEntry[] = [];


  cashbox_book_entries: BookEntry[] = [];
  cashbox_cash: BookEntry[] = [];
  cashbox_cheques: BookEntry[] = [];
  cashbox_filters = Object(CASHBOX_FILTER);
  cashbox_status: { cash: number; cheques: { nbr: number; amount: number; }; } = { cash: 0, cheques: { nbr: 0, amount: 0 } };

  // signals to manage the cashbox filtering and sorting and computations
  selected_cashbox_filter = signal<string>('');

  cashbox_book_entries_filtered = computed(() => {
    const _filter = (filter: any): BookEntry[] => {
      if (filter === CASHBOX_FILTER.CHEQUES_ONLY) {
        return this.cashbox_cheques;
        
      } else if (filter === CASHBOX_FILTER.CASH_ONLY) {
        return this.cashbox_cash;

      } else {
        return this.cashbox_book_entries;
      }
    }
    return _filter(this.selected_cashbox_filter());
  });

  cashbox_book_entries_filtered_total_value = computed(() => {
    return this.Round(this.cashbox_book_entries_filtered().reduce((acc, book_entry) => {
      return acc + ((book_entry.amounts?.[FINANCIAL_ACCOUNT.CASHBOX_debit] || 0) - (book_entry.amounts?.[FINANCIAL_ACCOUNT.CASHBOX_credit] || 0));
    }, 0));
  });

  cheques_deposits = computed(() => {
    return this.sort_deposits(this.cashbox_book_entries_filtered());
  });

  cash_acc = computed(() => {
    let acc: { name: string, value: number }[] = [];
    this.cashbox_book_entries_filtered().forEach((book_entry, index) => {
      let delta = (book_entry.amounts[FINANCIAL_ACCOUNT.CASHBOX_debit] || 0) - (book_entry.amounts[FINANCIAL_ACCOUNT.CASHBOX_credit] || 0)
      if (index === 0) {
        acc.push({ name: book_entry.date, value: this.Round(this.initial_liquidities.cash) + delta });
      } else {
        acc.push({ name: book_entry.date, value: this.Round(acc[index - 1].value + delta) });
      }
    });
    return acc;
  });


  bank_book_entries: BookEntry[] = [];

  current_cash_movements: number = 0;
  current_bank_movements: number = 0;
  current_assets_amount: number = 0;
  current_debt_amount: number = 0;
  current_expenses_operations_amount: number = 0;

  initial_liquidities: Liquidities = { cash: 0, bank: 0, savings: 0 };

  bank_accounts = Object.values(Bank_accounts) as FINANCIAL_ACCOUNT[];
  cashbox_accounts = Object.values(Cashbox_accounts) as FINANCIAL_ACCOUNT[];

  debts: Map<string, number> = new Map();
  assets: Map<string, EntryValue> = new Map();
  assets_entries: { [key: string]: EntryValue } = {};

  constructor(
    private bookService: BookService,
    private transactionService: TransactionService,
    private systemDataService: SystemDataService,
    private router: Router,
  ) { }

  ngOnInit() {

this.selected_report = this.bookService.get_report();

    this.systemDataService.get_configuration().pipe(
      tap((conf) => {
        this.expenses_accounts = conf.revenue_and_expense_tree.expenses.map((account) => account.key);
        this.products_accounts = conf.revenue_and_expense_tree.revenues.map((account) => account.key);
      }),
      switchMap((conf) => {
        return combineLatest([
          this.systemDataService.get_balance_sheet_initial_amounts(conf.season),
          this.bookService.list_book_entries$(conf.season)
        ]);
      }),
    ).subscribe(([liquidities, book_entries]) => {
      this.initial_liquidities = liquidities;
      this.book_entries = book_entries;

      this.bank_book_entries = this.book_entries.filter(book_entry => this.bank_accounts.some(op => book_entry.amounts[op] !== undefined));
      this.revenues = this.bookService.get_revenues();
      this.expenses = this.bookService.get_expenses();

      this.current_cash_movements = this.bookService.get_cashbox_movements_amount();
      this.current_bank_movements = this.bookService.get_bank_movements_amount();
      this.debts = this.bookService.get_debts();
      this.assets = this.bookService.get_customers_assets();
      this.assets_entries = Object.fromEntries(this.assets.entries());

      this.current_debt_amount = this.debts.size > 0 ? Array.from(this.debts.values()).reduce((acc, debt) => acc + debt, 0) : 0;
      this.current_assets_amount = this.assets.size > 0 ? Array.from(this.assets.values()).reduce((acc, asset) => acc + asset.total, 0) : 0;

      this.current_expenses_operations_amount = this.bookService.get_expenses_movements_amount();

      this.cashbox_book_entries = this.book_entries.filter(book_entry => this.cashbox_accounts.some(op => book_entry.amounts[op] !== undefined));;

      this.cashbox_cheques = this.cashbox_book_entries.filter((book_entry) =>
        this.transactionService.get_transaction(book_entry.transaction_id).cheque === 'in' ||
        (book_entry.transaction_id) === TRANSACTION_ID.dépôt_caisse_chèques);

      this.cashbox_cash = this.cashbox_book_entries.filter((book_entry) => this.transactionService.get_transaction(book_entry.transaction_id).cash !== 'none')
        .sort((a, b) => {
          return (a.date.localeCompare(b.date) === 0) ? (a.transaction_id === TRANSACTION_ID.dépôt_caisse_espèces ? 1 : -1) : a.date.localeCompare(b.date)
        });


        // calcul du montant total des chèques à déposer 
      let not_deposit = this.sort_deposits(this.cashbox_cheques)
      .find((deposit: Deposit_checked) => deposit.out_date  === undefined );
      if (not_deposit) {
        this.cashbox_status.cheques = {nbr: not_deposit.cheques_nbr, amount: not_deposit.amount};
        };
      this.cashbox_status.cash = this.initial_liquidities.cash + this.Round(this.cashbox_cash.reduce((acc, book_entry) => {
        return acc + (book_entry.amounts[FINANCIAL_ACCOUNT.CASHBOX_debit] || 0) - (book_entry.amounts[FINANCIAL_ACCOUNT.CASHBOX_credit] || 0);  
      },0));

      // this.selected_cashbox_filter.set(CASHBOX_FILTER.CASH_ONLY);
    });

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





  transaction_label(op_type: TRANSACTION_ID): string {
    return this.transactionService.get_transaction(op_type).label;
  }


  delete_book_entry(book_entry: BookEntry) {
    this.bookService.delete_book_entry(book_entry.id!).then((book_entry) => {
    });
  }

  show_book_entry(book_entry_id: string) {
    this.router.navigate(['/books/editor', book_entry_id]);
  }

  show(selection: string) {
    let id = selection.split(' : ')[1];
    this.router.navigate(['/books/editor', id]);
  }
  Round(value: number) {
    const neat = +(Math.abs(value).toPrecision(15));
    const rounded = Math.round(neat * 100) / 100;
    return rounded * Math.sign(value);
  }

  set_report(report:string) {
    this.bookService.set_report(report);
  }
}
