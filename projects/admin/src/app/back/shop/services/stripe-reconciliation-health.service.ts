import { Injectable } from '@angular/core';
import { BehaviorSubject, distinctUntilChanged, map, Observable } from 'rxjs';
import { BookEntry, FINANCIAL_ACCOUNT, TRANSACTION_ID } from '../../../common/interfaces/accounting.interface';
import { DBhandler } from '../../../common/services/graphQL.service';
import { BookService } from '../../services/book.service';

export interface StripeReconciliationHealthSnapshot {
  candidateBookEntries: BookEntry[];
  stripeTransactions: any[];
  abandonedTransactions: any[];
  allStripeTransactions: any[];
  abandonedCheckouts: BookEntry[];
  staleAbandonedCheckouts: BookEntry[];
}

const EMPTY_SNAPSHOT: StripeReconciliationHealthSnapshot = {
  candidateBookEntries: [],
  stripeTransactions: [],
  abandonedTransactions: [],
  allStripeTransactions: [],
  abandonedCheckouts: [],
  staleAbandonedCheckouts: [],
};

@Injectable({ providedIn: 'root' })
export class StripeReconciliationHealthService {
  private readonly staleAfterMs = 24 * 60 * 60 * 1000;
  private readonly snapshotSubject = new BehaviorSubject<StripeReconciliationHealthSnapshot>(EMPTY_SNAPSHOT);
  private refreshInProgress: Promise<StripeReconciliationHealthSnapshot> | null = null;

  readonly snapshot$: Observable<StripeReconciliationHealthSnapshot> = this.snapshotSubject.asObservable();
  readonly staleAbandonedCheckoutCount$: Observable<number> = this.snapshot$.pipe(
    map(snapshot => snapshot.staleAbandonedCheckouts.length),
    distinctUntilChanged(),
  );

  constructor(
    private bookService: BookService,
    private dbHandler: DBhandler,
  ) {}

  refresh(): Promise<StripeReconciliationHealthSnapshot> {
    if (this.refreshInProgress) return this.refreshInProgress;

    this.refreshInProgress = this.loadSnapshot().finally(() => {
      this.refreshInProgress = null;
    });
    return this.refreshInProgress;
  }

  private async loadSnapshot(): Promise<StripeReconciliationHealthSnapshot> {
    const allBookEntries = this.bookService.get_book_entries();
    const candidateBookEntries = this.findCandidateBookEntries(allBookEntries);
    const [stripeTransactions, abandonedTransactions] = await Promise.all([
      this.dbHandler.listUnpayoutedStripeTransactions(),
      this.dbHandler.listAbandonedStripeTransactions(),
    ]);
    const allStripeTransactions = [...stripeTransactions, ...abandonedTransactions];
    const abandonedCheckouts = candidateBookEntries.filter(bookEntry =>
      !allStripeTransactions.some((transaction: any) =>
        transaction.bookEntryId === bookEntry.id ||
        (bookEntry.stripeTag && transaction.stripeTag === bookEntry.stripeTag)
      )
    );
    const now = Date.now();
    const staleAbandonedCheckouts = abandonedCheckouts.filter(bookEntry =>
      this.getBookEntryTimestamp(bookEntry) <= now - this.staleAfterMs
    );

    const snapshot: StripeReconciliationHealthSnapshot = {
      candidateBookEntries,
      stripeTransactions,
      abandonedTransactions,
      allStripeTransactions,
      abandonedCheckouts,
      staleAbandonedCheckouts,
    };
    this.snapshotSubject.next(snapshot);
    return snapshot;
  }

  private findCandidateBookEntries(allBookEntries: BookEntry[]): BookEntry[] {
    const refundedCentsByStripeTag = new Map<string, number>();
    allBookEntries
      .filter(entry =>
        entry.transaction_id === TRANSACTION_ID.annulation_paiement_carte_adhérent &&
        !!entry.stripeTag
      )
      .forEach(entry => {
        const stripeCreditCents = Math.round(Math.abs((entry.amounts[FINANCIAL_ACCOUNT.STRIPE_credit] || 0) * 100));
        const stripeDebitCents = Math.round(Math.abs((entry.amounts[FINANCIAL_ACCOUNT.STRIPE_debit] || 0) * 100));
        const refundedCents = Math.max(stripeCreditCents, stripeDebitCents);
        const stripeTag = entry.stripeTag as string;
        refundedCentsByStripeTag.set(stripeTag, (refundedCentsByStripeTag.get(stripeTag) || 0) + refundedCents);
      });

    return allBookEntries.filter(entry => {
      if (
        (entry.transaction_id !== TRANSACTION_ID.achat_adhérent_par_carte &&
         entry.transaction_id !== TRANSACTION_ID.report_psp) ||
        entry.deposit_ref ||
        !entry.stripeTag
      ) {
        return false;
      }

      const stripeDebitCents = Math.round(Math.abs((entry.amounts[FINANCIAL_ACCOUNT.STRIPE_debit] || 0) * 100));
      const stripeCreditCents = Math.round(Math.abs((entry.amounts[FINANCIAL_ACCOUNT.STRIPE_credit] || 0) * 100));
      const grossCents = Math.max(stripeDebitCents, stripeCreditCents);
      return (refundedCentsByStripeTag.get(entry.stripeTag) || 0) < grossCents;
    });
  }

  private getBookEntryTimestamp(bookEntry: BookEntry): number {
    const timestamp = Date.parse(bookEntry.createdAt || `${bookEntry.date}T23:59:59`);
    return Number.isNaN(timestamp) ? Number.POSITIVE_INFINITY : timestamp;
  }
}