import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BookEntry, CUSTOMER_ACCOUNT, FINANCIAL_ACCOUNT, TRANSACTION_ID, TRANSFER_PROMISE_REF_PREFIX } from '../../common/interfaces/accounting.interface';
import { SystemDataService } from '../../common/services/system-data.service';
import { BookService } from '../services/book.service';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { BackNavigationService } from '../services/back-navigation.service';
import { ToastService } from '../../common/services/toast.service';
import { switchMap, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { Balance_sheet } from '../../common/interfaces/balance.interface';
import { FinancialReportService } from '../services/financial_report.service';
import { TransactionService } from '../services/transaction.service';

@Component({
  selector: 'app-bank-reconciliation',
  standalone: true,
  imports: [CommonModule, FormsModule, NgbModule],
  templateUrl: './bank-reconciliation.component.html',
  styleUrl: './bank-reconciliation.component.scss'
})
export class BankReconciliationComponent {
  truncature = '1.2-2';// '1.2-2';  //
  always_collapsed = true;
  current_season!: string;
  former_balance_sheet !: Balance_sheet;
  bank_book_entries: BookEntry[] = [];
  pending_transfer_entries: BookEntry[] = [];
  transfer_receipt_dates: Record<string, string> = {};
  transfer_reports: Record<string, string> = {};
  settling_transfer_ids = new Set<string>();

  bank_accounts: FINANCIAL_ACCOUNT[] = [
    FINANCIAL_ACCOUNT.BANK_credit,
    FINANCIAL_ACCOUNT.BANK_debit,
    FINANCIAL_ACCOUNT.SAVING_debit,
    FINANCIAL_ACCOUNT.SAVING_credit,
  ];


  bank_reports: string[] = [];


  db_loaded: boolean = false;

  get unreconciledCount(): number {
    return this.pending_transfer_entries.length
      + this.bank_book_entries.filter((entry) => entry.bank_report === null).length;
  }

  constructor(
    private bookService: BookService,
    private transactionService: TransactionService,
    private ToastService: ToastService,
    private systemDataService: SystemDataService,
    private financialService: FinancialReportService,
    private backNavigationService: BackNavigationService
  ) { }

  ngOnInit() {


    this.systemDataService.get_configuration().pipe(
      map((conf) => {
        this.current_season = conf.season!;
        let today = new Date();
        let season_last_date = this.systemDataService.last_date(conf.season!);
        if (new Date(season_last_date) < today) {
          this.bank_reports = this.systemDataService.get_season_months(new Date(season_last_date));
        }
        else {
          this.bank_reports = this.systemDataService.get_season_months(today);
        }
        return conf.season!;
      }),
      switchMap((season) => combineLatest([
        this.financialService.read_balance_sheet(this.systemDataService.previous_season(season)),
        this.bookService.list_book_entries()
      ])))
      .subscribe(([former_balance_sheet, book_entries]) => {
        this.former_balance_sheet = former_balance_sheet;
        this.bank_book_entries = book_entries
          .filter(book_entry => this.bank_accounts.some(op => book_entry.amounts[op] !== undefined))
          .sort((a, b) => {
            return a.date.localeCompare(b.date) === 0 ? (a.updatedAt ?? '').localeCompare(b.updatedAt ?? '') : a.date.localeCompare(b.date);
          });
        const settled_transfer_ids = new Set(
          book_entries
            .map(entry => entry.deposit_ref)
            .filter((ref): ref is string => !!ref?.startsWith(TRANSFER_PROMISE_REF_PREFIX))
            .map(ref => ref.slice(TRANSFER_PROMISE_REF_PREFIX.length))
        );
        this.pending_transfer_entries = book_entries
          .filter(entry => entry.transaction_id === TRANSACTION_ID.achat_adhérent_par_virement)
          .filter(entry => !entry.amounts[FINANCIAL_ACCOUNT.BANK_debit])
          .filter(entry => this.transfer_amount(entry) > 0)
          .filter(entry => !settled_transfer_ids.has(entry.id));
        this.pending_transfer_entries.forEach(entry => {
          this.transfer_receipt_dates[entry.id] ??= entry.date;
          this.transfer_reports[entry.id] ??= '';
        });
        this.db_loaded = true;
      });
  }


  // utilities

highlight(book_entry: BookEntry) {
    this.bookService.highlight_book_entry(book_entry);
  }

  highlight_class(book_entry: BookEntry): string {
    return this.bookService.highlighted(book_entry) ? 'g-0 p-0 table-info' : 'g-0 p-0';
  }

  previous_season(season: string): string {
    return this.systemDataService.previous_season(season);
  }

  transaction_label(book_entry: BookEntry): string {
    return this.transactionService.get_entry_label(book_entry)
      + (book_entry.cheque_ref ? ' - ' + book_entry.cheque_ref : '');
  }

  book_label(book_entry: BookEntry): string {
    let transaction = this.transactionService.get_transaction(book_entry.transaction_id);
    if (transaction.require_deposit_ref) {
      return book_entry.deposit_ref!;
    } else {
      if(transaction.nominative) {
        return (book_entry.operations ? book_entry.operations[0].member ?? '' : '');
      }
      return (book_entry.operations ? book_entry.operations[0].label : '');
    }
  }
  show_book_entry(book_entry_id: string) {
    this.backNavigationService.goToBooksEditorFull(book_entry_id);
  }

  transfer_amount(book_entry: BookEntry): number {
    return book_entry.operations.reduce((total, operation) =>
      total + (operation.values[CUSTOMER_ACCOUNT.DEBT_debit] ?? 0), 0);
  }

  transfer_member(book_entry: BookEntry): string {
    return book_entry.operations.find(operation =>
      (operation.values[CUSTOMER_ACCOUNT.DEBT_debit] ?? 0) > 0)?.member ?? '';
  }

  async settle_transfer(book_entry: BookEntry): Promise<void> {
    if (this.settling_transfer_ids.has(book_entry.id)) return;

    const receipt_date = this.transfer_receipt_dates[book_entry.id];
    const bank_report = this.transfer_reports[book_entry.id];
    if (!receipt_date || !bank_report) {
      this.ToastService.showWarning('virement', 'Renseignez la date bancaire et le relevé');
      this.transfer_reports[book_entry.id] = '';
      return;
    }
    if (bank_report < receipt_date.slice(2, 7)) {
      this.ToastService.showWarning('virement', 'Le relevé ne peut pas être antérieur à la réception du virement');
      this.transfer_reports[book_entry.id] = '';
      return;
    }
    const receipt_season = this.systemDataService.get_season(new Date(`${receipt_date}T12:00:00`));
    if (receipt_season !== this.current_season) {
      this.ToastService.showWarning('virement', `La date bancaire appartient à la saison ${receipt_season}`);
      this.transfer_reports[book_entry.id] = '';
      return;
    }

    const settlement_operations = book_entry.operations
      .filter(operation => (operation.values[CUSTOMER_ACCOUNT.DEBT_debit] ?? 0) > 0)
      .map(operation => ({
        label: 'règlement du virement annoncé',
        member: operation.member,
        values: { [CUSTOMER_ACCOUNT.DEBT_credit]: operation.values[CUSTOMER_ACCOUNT.DEBT_debit] },
      }));
    const amount = this.transfer_amount(book_entry);
    this.settling_transfer_ids.add(book_entry.id);
    try {
      await this.bookService.create_book_entry({
        id: '',
        season: receipt_season,
        date: receipt_date,
        transaction_id: TRANSACTION_ID.achat_adhérent_par_virement,
        amounts: { [FINANCIAL_ACCOUNT.BANK_debit]: amount },
        operations: settlement_operations,
        bank_report,
        deposit_ref: `${TRANSFER_PROMISE_REF_PREFIX}${book_entry.id}`,
      });
      this.ToastService.showSuccess('virement', 'Virement encaissé et créance soldée');
    } catch (error) {
      this.transfer_reports[book_entry.id] = '';
      throw error;
    } finally {
      this.settling_transfer_ids.delete(book_entry.id);
    }
  }

  update_transfer_report(book_entry: BookEntry) {
    if (!this.transfer_reports[book_entry.id]) return;
    this.settle_transfer(book_entry);
  }

  set_bank_report(book_entry: BookEntry, report: string) {
    if (book_entry.bank_report === null) {
      book_entry.bank_report = report;
    } else {
      book_entry.bank_report = null;
    }
    this.bookService.update_book_entry(book_entry);
  }
  update_bank_report(book_entry: BookEntry) {
    let date = book_entry.date.slice(2, 7);
    let report = book_entry.bank_report;
    if (report && report < date) {
      this.ToastService.showWarning('pointage annulé', 'le relevé ne peut être antérieur à l\'opération');
      book_entry.bank_report = null;
    }
    this.bookService.update_book_entry(book_entry);
  }



  movement_in(report: string | null): { bank: number, savings: number } {
    let book_entries = this.bank_book_entries.filter(book_entry => book_entry.bank_report === report);
    let bank = book_entries.reduce((acc, book_entry) => {
      return acc + (book_entry.amounts[FINANCIAL_ACCOUNT.BANK_debit] ?? 0);
    }, 0);
    let savings = book_entries.reduce((acc, book_entry) => {
      return acc + (book_entry.amounts[FINANCIAL_ACCOUNT.SAVING_debit] ?? 0);
    }, 0);
    return { bank, savings };
  }

  movement_out(report: string | null): { bank: number, savings: number } {
    let book_entries = this.bank_book_entries.filter(book_entry => book_entry.bank_report === report);
    let bank = book_entries.reduce((acc, book_entry) => {
      return acc + (book_entry.amounts[FINANCIAL_ACCOUNT.BANK_credit] ?? 0);
    }, 0);
    let savings = book_entries.reduce((acc, book_entry) => {
      return acc + (book_entry.amounts[FINANCIAL_ACCOUNT.SAVING_credit] ?? 0);
    }, 0);
    return { bank, savings };
  }


  balance(report: string): { bank: number, savings: number } {
    return this.bank_reports.filter(r => r.localeCompare(report) <= 0).reduce((acc, report) => {
      let in_ = this.movement_in(report);
      let out = this.movement_out(report);
      return { bank: acc.bank + in_.bank - out.bank, savings: acc.savings + in_.savings - out.savings };
    }
      , { bank: this.former_balance_sheet.bank, savings: this.former_balance_sheet.savings });
  }


}
