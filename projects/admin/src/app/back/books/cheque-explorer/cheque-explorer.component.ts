import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { combineLatest } from 'rxjs';

import { Bank } from '../../../common/interfaces/system-conf.interface';
import { BookEntry, FINANCIAL_ACCOUNT, TRANSACTION_ID } from '../../../common/interfaces/accounting.interface';
import { SystemDataService } from '../../../common/services/system-data.service';
import { BackNavigationService } from '../../services/back-navigation.service';
import { BookService } from '../../services/book.service';
import { TransactionService } from '../../services/transaction.service';

export type ChequeDepositStatus = 'in_cashbox' | 'pending_reference' | 'deposited' | 'anomaly';

export interface ChequeReference {
  entry: BookEntry;
  bank: string;
  number: string;
  member: string;
  amount: number;
}

export interface ChequeDeposit {
  reference: string;
  displayReference: string;
  date?: string;
  bankReport?: string | null;
  amount: number;
  depositedAmount: number;
  difference: number;
  status: ChequeDepositStatus;
  cheques: ChequeReference[];
  depositEntry?: BookEntry;
}

const UNASSIGNED_DEPOSIT = '__UNASSIGNED_DEPOSIT__';

function splitChequeReference(reference: string | undefined, banks: Bank[]): { bank: string; number: string } {
  if (!reference) return { bank: '', number: '' };
  const bank = banks.find(candidate => reference.startsWith(candidate.key));
  return bank
    ? { bank: bank.name, number: reference.slice(bank.key.length) }
    : { bank: '', number: reference };
}

export function buildChequeDeposits(
  entries: BookEntry[],
  banks: Bank[],
  isIncomingCheque: (entry: BookEntry) => boolean,
): ChequeDeposit[] {
  const groups = new Map<string, { cheques: BookEntry[]; depositEntry?: BookEntry }>();

  entries.filter(isIncomingCheque).forEach(entry => {
    const reference = entry.deposit_ref || UNASSIGNED_DEPOSIT;
    const group = groups.get(reference) ?? { cheques: [] };
    group.cheques.push(entry);
    groups.set(reference, group);
  });

  entries
    .filter(entry => entry.transaction_id === TRANSACTION_ID.dépôt_caisse_chèques && !!entry.deposit_ref)
    .forEach(entry => {
      const reference = entry.deposit_ref!;
      const group = groups.get(reference) ?? { cheques: [] };
      group.depositEntry = entry;
      groups.set(reference, group);
    });

  return Array.from(groups.entries())
    .map(([reference, group]) => {
      const cheques = group.cheques.map(entry => {
        const parsedReference = splitChequeReference(entry.cheque_ref, banks);
        return {
          entry,
          bank: parsedReference.bank,
          number: parsedReference.number,
          member: entry.operations.find(operation => operation.member)?.member ?? '',
          amount: entry.amounts[FINANCIAL_ACCOUNT.CASHBOX_debit] ?? 0,
        };
      });
      const amount = cheques.reduce((total, cheque) => total + cheque.amount, 0);
      const depositedAmount = group.depositEntry?.amounts[FINANCIAL_ACCOUNT.CASHBOX_credit] ?? 0;
      const difference = Math.round((depositedAmount - amount) * 100) / 100;
      const temporary = reference.startsWith('TEMP_');
      const status: ChequeDepositStatus = group.depositEntry
        ? (difference === 0 ? 'deposited' : 'anomaly')
        : temporary ? 'pending_reference' : 'in_cashbox';

      return {
        reference,
        displayReference: reference === UNASSIGNED_DEPOSIT ? 'Non déposés' : reference,
        date: group.depositEntry?.date,
        bankReport: group.depositEntry?.bank_report,
        amount,
        depositedAmount,
        difference,
        status,
        cheques: cheques.sort((a, b) => b.entry.date.localeCompare(a.entry.date)),
        depositEntry: group.depositEntry,
      };
    })
    .sort((a, b) => {
      const statusOrder: Record<ChequeDepositStatus, number> = {
        anomaly: 0,
        pending_reference: 1,
        in_cashbox: 2,
        deposited: 3,
      };
      return statusOrder[a.status] - statusOrder[b.status]
        || (b.date ?? '').localeCompare(a.date ?? '')
        || b.displayReference.localeCompare(a.displayReference);
    });
}

@Component({
  selector: 'app-cheque-explorer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cheque-explorer.component.html',
  styleUrl: './cheque-explorer.component.scss',
})
export class ChequeExplorerComponent {
  season = '';
  deposits: ChequeDeposit[] = [];
  search = '';
  statusFilter: ChequeDepositStatus | 'all' = 'all';
  readonly statusLabels: Record<ChequeDepositStatus, string> = {
    in_cashbox: 'En caisse',
    pending_reference: 'Référence à compléter',
    deposited: 'Déposé',
    anomaly: 'Écart à contrôler',
  };

  constructor(
    private systemDataService: SystemDataService,
    private bookService: BookService,
    private transactionService: TransactionService,
    private backNavigationService: BackNavigationService,
  ) {}

  ngOnInit(): void {
    combineLatest([
      this.systemDataService.get_configuration(),
      this.bookService.list_book_entries(),
    ]).subscribe(([configuration, entries]) => {
      this.season = configuration.season!;
      this.deposits = buildChequeDeposits(
        entries,
        configuration.banks,
        entry => this.transactionService.get_transaction(entry.transaction_id).cheque === 'in',
      );
    });
  }

  get visibleDeposits(): ChequeDeposit[] {
    const search = this.search.trim().toLocaleLowerCase('fr');
    return this.deposits.filter(deposit => {
      if (this.statusFilter !== 'all' && deposit.status !== this.statusFilter) return false;
      if (!search) return true;
      return [
        deposit.displayReference,
        deposit.bankReport ?? '',
        ...deposit.cheques.flatMap(cheque => [cheque.bank, cheque.number, cheque.member]),
      ].some(value => value.toLocaleLowerCase('fr').includes(search));
    });
  }

  get chequeCount(): number {
    return this.deposits.reduce((total, deposit) => total + deposit.cheques.length, 0);
  }

  get chequeAmount(): number {
    return this.deposits.reduce((total, deposit) => total + deposit.amount, 0);
  }

  get anomalyCount(): number {
    return this.deposits.filter(deposit => deposit.status === 'anomaly').length;
  }

  showEntry(entry: BookEntry): void {
    this.backNavigationService.goToBooksEditorFull(entry.id);
  }
}