import { Injectable } from '@angular/core';
import { generateClient } from 'aws-amplify/api';

import { BookEntry, Revenue, FINANCIAL_ACCOUNT, BALANCE_ACCOUNT, Expense, CUSTOMER_ACCOUNT, TRANSACTION_ID, Operation, AMOUNTS } from '../../../common/accounting.interface';
import { Schema } from '../../../../amplify/data/resource';
import { BehaviorSubject, catchError, combineLatest, from, map, Observable, of, switchMap, tap, throwError } from 'rxjs';
import { SystemDataService } from '../../../common/services/system-data.service';
import { ToastService } from '../../../common/toaster/toast.service';
import { TransactionService } from './transaction.service';
import { TRANSACTION_CLASS } from '../../../common/transaction.definition';
import { Profit_and_loss } from '../../../common/system-conf.interface';

type BookEntry_input = Schema['BookEntry']['type'];
type BookEntry_output = BookEntry & {
  createdAt: Date,
  updatedAt: Date,
}
@Injectable({
  providedIn: 'root'
})
export class BookService {

  private _book_entries!: BookEntry[];
  private _book_entries$ = new BehaviorSubject<BookEntry[]>([]);
  private season_filter: string = '';
  private force_reload: boolean = false; // force reload of book entries if true

  constructor(
    private systemDataService: SystemDataService,
    private toastService: ToastService,
    private transactionService: TransactionService,
  ) {
  }

  private trace_on(): boolean {
    return this.systemDataService.trace_on();
  }

  private jsonified_entry(entry: BookEntry): BookEntry_input {
    const replacer = (key: string, value: any) => {
      if (key === 'amounts' || key === 'values') {
        return JSON.stringify(value);
      }
      return value;
    }

    let stringified = JSON.stringify(entry, replacer);
    return JSON.parse(stringified) as BookEntry_input;
  }

  private parsed_entry(entry: BookEntry_output): BookEntry {
    const replacer = (key: string, value: any) => {
      if (key === 'amounts' || key === 'values') {
        return JSON.parse(value);
      }
      return value
    }

    let destringified = JSON.stringify(entry, replacer);
    return JSON.parse(destringified) as BookEntry;

  }

  // CRUD(L) BookEntry

  // bulk create

  book_entries_bulk_create$(book_entries: BookEntry[]): Observable<number> {

    const client = generateClient<Schema>();

    const create_entry = async (book_entry: BookEntry): Promise<BookEntry> => {
      let jsonified_entry: BookEntry_input = this.jsonified_entry(book_entry);
      const { id, ...jsonified_entry_without_id } = jsonified_entry;

      try {
        const response = await client.models.BookEntry.create(jsonified_entry_without_id, { authMode: 'identityPool' });
        if (response.errors) {
          console.error('error creating', this.jsonified_entry(book_entry), response.errors);
          return Promise.reject(JSON.stringify(response.errors));
        }
        const created_entry = this.parsed_entry(response.data as unknown as BookEntry_output);
        return Promise.resolve(created_entry);
      } catch (error) {
        console.error('error', error);
        return Promise.reject(error instanceof Error ? error.message : String(error));
      }
    }

    const promises = book_entries.map(book_entry => create_entry(book_entry));

    return from(Promise.all(promises)).pipe(
      map((created_entries) => {
        this._book_entries = this._book_entries.concat(created_entries)
          .sort((b, a) => { return a.date.localeCompare(b.date); });
        this._book_entries$.next(this._book_entries);
        return created_entries.length;
      }),
      catchError((error) => {
        console.error('Error creating book entries:', error);
        return of(0);
      })
    );
  }


  // create

  async create_book_entry(book_entry: BookEntry) {
    const client = generateClient<Schema>();
    let jsonified_entry: BookEntry_input = this.jsonified_entry(book_entry);
    const { id, ...jsonified_entry_without_id } = jsonified_entry;

    try {
      const { data, errors } = await client.models.BookEntry.create(
        jsonified_entry_without_id,
        { authMode: 'identityPool' }
      );
      if (errors) { throw errors; }

      const created_entry = this.parsed_entry(data as unknown as BookEntry_output);
      this._book_entries.push(created_entry);
      this._book_entries$.next(this._book_entries.sort((b, a) => {
        return a.date.localeCompare(b.date) === 0 ? (a.updatedAt ?? '').localeCompare(b.updatedAt ?? '') : a.date.localeCompare(b.date);
      }));
      return (created_entry);

    } catch (error) {

      let errorType: string = '.. accès refusé ... êtes-vous bien connecté ?';
      if (Array.isArray(error) && error.length > 0 && typeof error[0] === 'object' && error[0] !== null && 'errorType' in error[0]) {
        errorType = (error[0] as { errorType: string, message: string }).errorType;
      }
      switch (errorType) {
        case 'Unauthorized':
          this.toastService.showWarningToast('base comptabilité', 'Vous n\'êtes pas autorisé à créer une entrée comptable');
          break;
        default:
          this.toastService.showErrorToast('base comptabilité', errorType);
      }
      throw errorType;
    }
  }

  // read 

  async read_book_entry(entry_id: string) {
    const client = generateClient<Schema>();

    try {
      const response = await client.models.BookEntry.get(
        { id: entry_id },
        { selectionSet: ['id', 'season', 'tag', 'date', 'amounts', 'operations.*', 'transaction_id', 'cheque_ref', 'deposit_ref', 'bank_report'] }
      );
      if (response.errors) {
        console.error('error', response.errors);
        throw new Error(JSON.stringify(response.errors));
      }
      return this.parsed_entry(response.data as unknown as BookEntry_output);
    } catch (error) {
      console.error('error', error);
      throw new Error(error instanceof Error ? error.message : String(error));
    }
  }

  // update

  async update_book_entry(book_entry: BookEntry) {
    const client = generateClient<Schema>();
    try {
      const response = await client.models.BookEntry.update(
        this.jsonified_entry(book_entry),
        { authMode: 'userPool' });
      if (response.errors) {
        console.error('error', response.errors);
        throw new Error(JSON.stringify(response.errors));
      }
      const updated_entry = this.parsed_entry(response.data as unknown as BookEntry_output);
      this._book_entries = this._book_entries.map((entry) => entry.id === updated_entry.id ? updated_entry : entry);
      this._book_entries$.next(this._book_entries.sort((b, a) => {
        return a.date.localeCompare(b.date) === 0 ? (a.updatedAt ?? '').localeCompare(b.updatedAt ?? '') : a.date.localeCompare(b.date);
      }));
      return updated_entry;
    } catch (error: any) {
      this.toastService.showWarningToast('base comptabilité', 'Vous n\'êtes pas autorisé à créer une entrée comptable');
      throw error;
    };
  }

  // delete

  delete_book_entry(entry_id: string) {
    const client = generateClient<Schema>();

    return client.models.BookEntry.delete({ id: entry_id },
      { authMode: 'userPool' })
      .then((response) => {
        if (response.errors) {
          console.error('error', response.errors);
          throw new Error(JSON.stringify(response.errors));
        }
        this._book_entries = this._book_entries.filter((entry) => entry.id !== entry_id);
        this._book_entries$.next(this._book_entries.sort((b, a) => {
          return a.date.localeCompare(b.date) === 0 ? (a.updatedAt ?? '').localeCompare(b.updatedAt ?? '') : a.date.localeCompare(b.date);
        }));
        return response;
      })
      .catch((error) => {
        this.toastService.showWarningToast('base comptabilité', 'Vous n\'êtes pas autorisé à supprimer une entrée comptable');
        throw error instanceof Error ? error.message : String(error);
      });
  }

  // list

  list_book_entries$(season: string): Observable<BookEntry[]> {

    const fetchBookentries = async (_season: string): Promise<BookEntry[]> => {
      let failed = false;
      let entries: BookEntry[] = [];
      try {
        const client = generateClient<Schema>();
        let token: any = null;
        let nbloops = 0;
        // let entries: BookEntry[] = [];
        do {
          const { data, nextToken, errors } = await client.models.BookEntry.list({
            filter: { season: { eq: _season } },
            limit: 300,
            nextToken: token,
            authMode: 'identityPool' // use identity pool to allow unauthenticated access
          });
          if (errors) {
            console.error('client.models.BookEntry.list failed !! : ', errors);
            failed = true;
            throw new Error(JSON.stringify(errors));
          }
          let new_jsoned_entries = data as unknown as BookEntry_output[];
          entries = [...entries, ...new_jsoned_entries.map((entry) => this.parsed_entry(entry))];
          token = nextToken;

          // if (this.trace_on()) console.log('loop %s => %s', nbloops,entries.length);
        } while (token !== null && nbloops++ < 10 && !failed)

        if (token !== null) {
          this.toastService.showWarningToast('base comptabilité', 'beaucoup trop d\'entrées à charger , veuillez répeter l\'opération');
        }
        return entries;
      }
      catch (error) {
        // failed = true;
        // console.error('error', error);
        throw new Error(error instanceof Error ? error.message : String(error));
      }
    }

    if (this.season_filter !== season) {
      this.season_filter = season;
      this.force_reload = true; // force reload of book entries if season changed
    } else { this.force_reload = false; }

    if (this._book_entries && !this.force_reload) {
      // if (this.trace_on()) console.log('%s book entries retrieved from cache', this._book_entries.length);
      return this._book_entries$.asObservable();
    } else {

      return from(fetchBookentries(season)).pipe(
        map((entries) => {
          this._book_entries = entries.sort((a, b) => {
            return a.date.localeCompare(b.date) === 0 ? (a.updatedAt ?? '').localeCompare(b.updatedAt ?? '') : a.date.localeCompare(b.date);
          });
          return this._book_entries;
        }),
        switchMap((entries) => {
          this._book_entries$.next(this._book_entries);
          // if (this.trace_on()) console.log('%s book entries loaded from S3', entries.length);
          return this._book_entries$.asObservable();
        }),
        catchError((error) => {
          console.error('Error fetching book entries:', error);
          this.toastService.showErrorToast('base comptabilité', 'Erreur de chargement de la base de données');
          return of([] as BookEntry[]);
        })
      );
    }
  }

  book_entries_bulk_delete$(season: string): Observable<number> {

    const fetchBookentriesIds = async (_season: string) => {
      try {
        const client = generateClient<Schema>();
        let token: any = null;
        let nbloops = 0;
        let entriesIds: string[] = [];
        do {
          const { data, nextToken, errors } = await client.models.BookEntry.list({
            filter: { season: { eq: _season } },
            limit: 300,
            nextToken: token,
          });
          if (errors) {
            console.error(errors);
            throw new Error(JSON.stringify(errors));
          }
          let json_entries: BookEntry[] = data as unknown as BookEntry_output[];
          entriesIds = [...entriesIds, ...json_entries.map((entry) => this.parsed_entry(entry as unknown as BookEntry_output).id)];
          token = nextToken;
        } while (token !== null && nbloops++ < 10); // 10 loops max to avoid infinite loop
        if (token !== null) {
          this.toastService.showWarningToast('base comptabilité', 'beaucoup trop d\'entrées à supprimer , veuillez répeter l\'opération');
        }

        return entriesIds;
      }

      catch (error) {
        console.error('error', error);
        throw new Error(error instanceof Error ? error.message : String(error));
      }
    };

    const deleteBookentries = async (ids: string[]): Promise<BookEntry[]> => {
      const client = generateClient<Schema>();
      const promises = ids.map(id => {
        return client.models.BookEntry.delete({ id: id })
      });

      return Promise.all(promises).then(results => {
        return results.map(result => {
          if (result.errors) {
            throw new Error(JSON.stringify(result.errors));
          }
          return this.parsed_entry(result.data as unknown as BookEntry_output);
        });
      });
    };

    return from(fetchBookentriesIds(season)).pipe(
      switchMap((ids) => from(deleteBookentries(ids))),
      tap((deleted_entries) => {
        deleted_entries.forEach((deleted_entry) => {
          this._book_entries = this._book_entries.filter((entry) => entry.id !== deleted_entry.id); // remove 
        });
        this._book_entries$.next(this._book_entries);
      }),
      map((deleted_entries) => {
        return deleted_entries.length;
      }),
      catchError((error) => {
        throw Error('Error deleting book entries:' + error);
      }
      )
    );

  }

  // utility functions

  get_book_entries(): BookEntry[] {

    return this._book_entries ?? []; // if no book entries are loaded yet
  }

  get_operations(): (Revenue | Expense)[] {
    if (!this._book_entries) { // if no book entries are loaded yet
      return [] as (Revenue | Expense)[]
    }


    return this._book_entries
      .reduce((acc, book_entry) => {
        const revenues = book_entry.operations
          .map(op => ({
            ...op,
            season: book_entry.season,
            date: book_entry.date,
            book_entry_id: book_entry.id,
            tag: book_entry.tag ?? undefined
          } as Revenue));
        return [...acc, ...revenues];
      }, [] as (Revenue | Expense)[]);
  }

  get_revenues(): Revenue[] {

    if (!this._book_entries) { // if no book entries are loaded yet
      return [] as Revenue[]
    }

    return this._book_entries
      .filter(book_entry => [TRANSACTION_CLASS.OTHER_REVENUE, TRANSACTION_CLASS.REVENUE_FROM_MEMBER, TRANSACTION_CLASS.REIMBURSEMENT].includes(this.transactionService.transaction_class(book_entry.transaction_id)))
      .reduce((acc, book_entry) => {
        const revenues = book_entry.operations
          .map(op => ({
            ...op,
            season: book_entry.season,
            date: book_entry.date,
            book_entry_id: book_entry.id,
            tag: book_entry.tag ?? undefined
          } as Revenue));
        return [...acc, ...revenues];
      }, [] as Revenue[]);
  }


  get_revenues_from_members(): Revenue[] {

    if (!this._book_entries) { // if no book entries are loaded yet
      return [] as Revenue[]
    }

    return this._book_entries
      .filter(book_entry => [TRANSACTION_CLASS.REVENUE_FROM_MEMBER].includes(this.transactionService.transaction_class(book_entry.transaction_id)))
      .reduce((acc, book_entry) => {
        const revenues = book_entry.operations
          .map(op => ({
            ...op,
            season: book_entry.season,
            date: book_entry.date,
            book_entry_id: book_entry.id,
            tag: book_entry.tag ?? undefined
          } as Revenue));
        return [...acc, ...revenues];
      }, [] as Revenue[]);
  }

  get_cashbox_movements_amount(selection?: 'cash' | 'cheques'): number {
    if (this._book_entries === undefined) { // if no book entries are loaded yet
      return 0;
    }
    if (selection === 'cheques') {
      return this.Round(this._book_entries
        .filter((book_entry) => this.transactionService.get_transaction(book_entry.transaction_id).cheque !== 'none')
        .reduce((acc, book_entry) => acc + (book_entry.amounts[FINANCIAL_ACCOUNT.CASHBOX_debit] || 0) - (book_entry.amounts[FINANCIAL_ACCOUNT.CASHBOX_credit] || 0), 0));
    }
    if (selection === 'cash') {

      return this.Round(this._book_entries
        .filter((book_entry) => this.transactionService.get_transaction(book_entry.transaction_id).cash !== 'none')
        .reduce((acc, book_entry) => acc + (book_entry.amounts[FINANCIAL_ACCOUNT.CASHBOX_debit] || 0) - (book_entry.amounts[FINANCIAL_ACCOUNT.CASHBOX_credit] || 0), 0));
    }
    return this.Round(this._book_entries.reduce((acc, book_entry) =>
      acc + (book_entry.amounts[FINANCIAL_ACCOUNT.CASHBOX_debit] || 0) - (book_entry.amounts[FINANCIAL_ACCOUNT.CASHBOX_credit] || 0), 0));
  }

  get_cash_movements_amount(): number {
    return this.get_cashbox_movements_amount('cash');
  }

  get_bank_movements_amount(): number {
    if (this._book_entries === undefined) { // if no book entries are loaded yet
      return 0; // no outstanding expenses
    }
    return this.Round(this._book_entries
      .filter((entry) => (entry.bank_report !== null && entry.bank_report !== undefined))
      .reduce((acc, book_entry) =>
        acc + (book_entry.amounts[FINANCIAL_ACCOUNT.BANK_debit] || 0) - (book_entry.amounts[FINANCIAL_ACCOUNT.BANK_credit] || 0), 0));
  }

  get_uncashed_cheques_amount(): number {
    if (this._book_entries === undefined) { // if no book entries are loaded yet
      return 0; // no outstanding expenses
    }
    return this.Round(this._book_entries
      .filter((book_entry) =>
        this.transactionService.get_transaction(book_entry.transaction_id).cheque !== 'none')
      .filter((book_entry) => book_entry.deposit_ref === null || book_entry.deposit_ref === undefined)
      .reduce((acc, book_entry) => acc + (book_entry.amounts[FINANCIAL_ACCOUNT.CASHBOX_debit] || 0), 0));
  }


  get_savings_movements_amount(): number {
    if (this._book_entries === undefined) { // if no book entries are loaded yet
      return 0; // no outstanding expenses
    }
    return this.Round(this._book_entries.reduce((acc, book_entry) => {
      return acc + (book_entry.amounts[FINANCIAL_ACCOUNT.SAVING_debit] || 0) - (book_entry.amounts[FINANCIAL_ACCOUNT.SAVING_credit] || 0);
    }, 0));
  }

  private _is_bankable(book_entry: BookEntry): boolean {
    return (book_entry.transaction_id === TRANSACTION_ID.dépense_par_chèque
      || book_entry.transaction_id === TRANSACTION_ID.dépense_par_prélèvement
      || book_entry.transaction_id === TRANSACTION_ID.dépense_par_virement
      || book_entry.transaction_id === TRANSACTION_ID.dépense_par_carte
      || book_entry.transaction_id === TRANSACTION_ID.report_chèque
      || book_entry.transaction_id === TRANSACTION_ID.report_prélèvement
    )
  }
  get_bank_outstanding_expenses_amount(): number {
    if (this._book_entries === undefined) { // if no book entries are loaded yet
      return 0; // no outstanding expenses
    }
    return this.Round(this._book_entries.reduce((acc, book_entry) => {
      return acc + ((!book_entry.bank_report || book_entry.bank_report === null) && this._is_bankable(book_entry) ? (book_entry.amounts[FINANCIAL_ACCOUNT.BANK_credit] || 0) : 0);
    }, 0));
  }


  get_bank_outstanding_expenses(): BookEntry[] {
    if (this._book_entries === undefined) { // if no book entries are loaded yet
      return [];
    }
    return this._book_entries.filter((book_entry) =>
      !book_entry.bank_report || book_entry.bank_report === null && this._is_bankable(book_entry));
  }

  get_debts(): Map<string, { total: number, entries: BookEntry[] }> {
    let debt = new Map<string, { total: number, entries: BookEntry[] }>();

    if (this._book_entries === undefined) { // if no book entries are loaded yet
      return debt;
    }

    this._book_entries.forEach((book_entry) => {
      book_entry.operations.forEach((op) => {
        if (op.values[CUSTOMER_ACCOUNT.DEBT_debit]) {
          let name = op.member;   // member is the name of the debt owner & payee
          if (!name) throw new Error('no member name found');
          debt.set(name, {
            total: (debt.get(name)?.total || 0) + op.values[CUSTOMER_ACCOUNT.DEBT_debit],
            entries: [...(debt.get(name)?.entries || []), book_entry]
          });
        }
        if (op.values[CUSTOMER_ACCOUNT.DEBT_credit]) {
          let name = op.member;   // member is the name of the debt owner & payee
          if (!name) throw new Error('no member name found');
          debt.set(name, {
            total: (debt.get(name)?.total || 0) - op.values[CUSTOMER_ACCOUNT.DEBT_credit],
            entries: [...(debt.get(name)?.entries || []), book_entry]
          });
        }
      });
    });
    // console.log('%s debt is : ', member_full_name, debt.get(member_full_name) || 0);
    return debt;

  }


  get_clients_debts_value(): number {  // dettes clients

    if (this._book_entries === undefined) { // if no book entries are loaded yet
      return 0; // no outstanding expenses
    }
    let value = 0;
    // console.log(':::', this._book_entries);
    this._book_entries.forEach((book_entry) => {
      book_entry.operations.forEach((op) => {
        if (op.values[CUSTOMER_ACCOUNT.DEBT_debit]) {
          value += op.values[CUSTOMER_ACCOUNT.DEBT_debit];
        }
        if (op.values[CUSTOMER_ACCOUNT.DEBT_credit]) {
          value -= op.values[CUSTOMER_ACCOUNT.DEBT_credit];
        }
      });
    });
    return value;
  }

  // get_clients_debit_value(): number {  // dettes clients

  //   if (this._book_entries === undefined) { // if no book entries are loaded yet
  //     return 0; // no outstanding expenses
  //   }
  //   let value = 0;
  //   // console.log(':::', this._book_entries);
  //   this._book_entries.forEach((book_entry) => {
  //     book_entry.operations.forEach((op) => {
  //       if (op.values[CUSTOMER_ACCOUNT.DEBT_debit]) {
  //         value += op.values[CUSTOMER_ACCOUNT.DEBT_debit];
  //       }
  //       // if (op.values[CUSTOMER_ACCOUNT.DEBT_credit]) {
  //       //   value -= op.values[CUSTOMER_ACCOUNT.DEBT_credit];
  //       // }
  //     });
  //   });
  //   return value;
  // }

  get_clients_credit_value(): number {  // dettes clients

    if (this._book_entries === undefined) { // if no book entries are loaded yet
      return 0; // no outstanding expenses
    }
    let value = 0;
    // console.log(':::', this._book_entries);
    this._book_entries.forEach((book_entry) => {
      book_entry.operations.forEach((op) => {
        // if (op.values[CUSTOMER_ACCOUNT.DEBT_debit]) {
        //   value += op.values[CUSTOMER_ACCOUNT.DEBT_debit];
        // }
        if (op.values[CUSTOMER_ACCOUNT.DEBT_credit]) {
          value += op.values[CUSTOMER_ACCOUNT.DEBT_credit];
        }
      });
    });
    return value;
  }


  // avoir clients :
  get_customers_assets(): Map<string, { total: number, entries: BookEntry[] }> {

    if (this._book_entries === undefined) { // if no book entries are loaded yet
      return new Map<string, { total: number, entries: BookEntry[] }>(); // no outstanding expenses
    }

    let assets = new Map<string, { total: number, entries: BookEntry[] }>();
    this._book_entries.forEach((book_entry) => {

      book_entry.operations.forEach((op) => {
        if (op.values[CUSTOMER_ACCOUNT.ASSET_debit]) {
          let name = op.member;
          if (!name) throw new Error('no member name found');
          assets.set(name, {
            total: (assets.get(name)?.total || 0) - op.values[CUSTOMER_ACCOUNT.ASSET_debit],
            entries: [...(assets.get(name)?.entries || []), book_entry]
          }
          );
        }
        if (op.values[CUSTOMER_ACCOUNT.ASSET_credit]) {
          let name = op.member;
          if (!name) throw new Error('no member name found');
          assets.set(name, {
            total: (assets.get(name)?.total || 0) + op.values[CUSTOMER_ACCOUNT.ASSET_credit],
            entries: [...(assets.get(name)?.entries || []), book_entry]
          }
          );
        }
      });
    });
    return assets;
  }
  get_customers_assets_amount(): number {
    let assets = this.get_customers_assets();
    return assets.size > 0 ? Array.from(assets.values()).reduce((acc, asset) => acc + asset.total, 0) : 0;

  }

  find_member_debt(member_full_name: string): number {
    let debts = this.get_debts();

    // console.log('%s debt is : ', member_full_name, debt.get(member_full_name) || 0);
    return debts.get(member_full_name)?.total || 0;

  }

  find_assets(member_full_name: string): number {
    let assets = new Map<string, number>();
    this._book_entries.forEach((book_entry) => {

      book_entry.operations.forEach((op) => {
        if (op.values[CUSTOMER_ACCOUNT.ASSET_debit]) {
          let name = op.member;
          if (!name) throw new Error('no member name found');
          assets.set(name, (assets.get(name) || 0) - op.values[CUSTOMER_ACCOUNT.ASSET_debit]);
        }
        if (op.values[CUSTOMER_ACCOUNT.ASSET_credit]) {
          let name = op.member;
          if (!name) throw new Error('no member name found');
          assets.set(name, (assets.get(name) || 0) + op.values[CUSTOMER_ACCOUNT.ASSET_credit]);
        }
      });
    });
    // console.log('%s assets is : ', member_full_name, assets.get(member_full_name) || 0);
    return assets.get(member_full_name) || 0;
  }


  get_expenses(): Expense[] {
    if (!this._book_entries) { // if no book entries are loaded yet
      return [] as Expense[]
    }
    return this._book_entries
      .filter(book_entry => [TRANSACTION_CLASS.OTHER_EXPENSE, TRANSACTION_CLASS.EXPENSE_FOR_MEMBER].includes(this.transactionService.transaction_class(book_entry.transaction_id)))
      .reduce((acc, book_entry) => {
        const expenses = book_entry.operations
          .map(op => ({
            ...op,
            season: book_entry.season,
            date: book_entry.date,
            book_entry_id: book_entry.id,
            tag: book_entry.tag ?? undefined
          } as Expense));
        return [...acc, ...expenses];
      }, [] as Expense[]);
  }


  // private _sum_values(values: { [key: string]: number }): number {
  //   return Object.values(values).reduce((acc, value) => acc + value, 0);
  // }

  update_deposit_refs(deposit_ref: string, new_deposit_ref: string) {
    let new_entries: BookEntry[] = [];
    this._book_entries.forEach((entry) => {
      if (entry.deposit_ref === deposit_ref) {
        entry.deposit_ref = new_deposit_ref;
        new_entries.push(entry);
      }
    });
    if (new_entries.length > 0) {
      let n = new_entries.length;
      new_entries.forEach((entry) => {
        this.update_book_entry(entry);
      });
      this.toastService.showSuccessToast('base comptabilité', `${n} références de dépôt mises à jour`);
      this._book_entries$.next(this._book_entries);
    } else {
      throw Error('enable to find any entry with deposit_ref : ' + deposit_ref);
    }
  }

  create_tournament_fees_entry(date: string, fees_amount: number) {
    let amounts: AMOUNTS = {};
    amounts[FINANCIAL_ACCOUNT.CASHBOX_debit] = fees_amount;

    let operation: Operation = { label: 'droits de table', values: { 'DdT': fees_amount } };
    // operation.values['DdT'] = fees_amount;
    // operation.label = 'droits de table';

    let seasonValue = this.systemDataService.get_season(new Date(date));
    const entry: BookEntry = {
      id: '',
      season: seasonValue,
      date: date,
      amounts: amounts,
      operations: [operation],
      // class: TRANSACTION_CLASS.OTHER_REVENUE,
      transaction_id: TRANSACTION_ID.vente_en_espèces,
    };
    return this.create_book_entry(entry);
  }


  get_total_revenues(key?: string): number {
    let total = (values: { [key: string]: number }): number => {
      return Object.entries(values).reduce((acc, [key, value]) => acc + ((!Object.values(CUSTOMER_ACCOUNT).includes(key as CUSTOMER_ACCOUNT)) ? value : 0), 0);
    }

    if (!key) {
      return this.get_revenues().reduce((acc, revenue) => acc + total(revenue.values), 0);
    } else {
      return this.get_revenues().reduce((acc, revenue) => acc + (revenue.values[key] ? revenue.values[key] : 0), 0);
    }
  }


  get_total_expenses(key?: string): number {
    let total = (values: { [key: string]: number }): number => {
      return Object.entries(values).reduce((acc, [key, value]) => acc + ((!Object.values(CUSTOMER_ACCOUNT).includes(key as CUSTOMER_ACCOUNT)) ? value : 0), 0);
    }
    if (!key) {
      return this.get_expenses().reduce((acc, expense) => acc + total(expense.values), 0);
    } else {
      return this.get_expenses().reduce((acc, expense) => acc + (expense.values[key] ? expense.values[key] : 0), 0);
    }
  }

  get_total_amount(entry: BookEntry): number {
    let _in = Object.entries(entry.amounts).reduce((acc, [key, value]: [string, number]) => acc + (key.includes('in') ? value : 0), 0);
    let _out = Object.entries(entry.amounts).reduce((acc, [key, value]: [string, number]) => acc + (key.includes('out') ? value : 0), 0);

    return (_in === 0) ? _out : _in;
  }

  get_trading_result(): number {
    return this.Round(this.get_total_revenues() - this.get_total_expenses());
  }

  // générer une écriture d'annulation d'avoir adhérent
  asset_cancelation(date: string, member: string, value: number): Promise<BookEntry> {

    if (value <= 0) {
      this.toastService.showWarningToast('base comptabilité', 'corrigez l\'écriture comptable pour éviter cette valeur négative');
      return Promise.resolve({} as BookEntry);
    }

    let pl_keys: Profit_and_loss = this.systemDataService.get_profit_and_loss_keys();

    let amounts: AMOUNTS = { [FINANCIAL_ACCOUNT.CASHBOX_debit]: 0 };
    let operation: Operation = {
      label: 'annulation avoir adhérent',
      values: { [CUSTOMER_ACCOUNT.ASSET_debit]: value, [pl_keys.credit_key]: value },
      member: member
    };

    let season = this.systemDataService.get_season(new Date(date));

    const entry: BookEntry = {
      id: '',
      tag: 'annulation avoir adhérent',
      season: season,
      date: date,
      amounts: amounts,
      operations: [operation],
      transaction_id: TRANSACTION_ID.achat_adhérent_en_espèces,
    };
    return this.create_book_entry(entry);
  }
  // générer une écriture d'annulation d'une dette adhérent 
  debt_cancelation(date: string, member: string, value: number): Promise<BookEntry> {

    if (value <= 0) {
      this.toastService.showWarningToast('base comptabilité', 'corrigez l\'écriture comptable pour éviter cette valeur négative');
      return Promise.resolve({} as BookEntry);
    }

    let pl_keys: Profit_and_loss = this.systemDataService.get_profit_and_loss_keys();

    let amounts: AMOUNTS = { [FINANCIAL_ACCOUNT.CASHBOX_debit]: 0 };
    let operation: Operation = {
      label: 'annulation dette adhérent',
      values: { [CUSTOMER_ACCOUNT.DEBT_credit]: value, [pl_keys.debit_key]: value },
      member: member
    };

    let season = this.systemDataService.get_season(new Date(date));

    const entry: BookEntry = {
      id: '',
      tag: 'annulation dette adhérent',
      season: season,
      date: date,
      amounts: amounts,
      operations: [operation],
      transaction_id: TRANSACTION_ID.annulation_dette_adhérent,
    };
    return this.create_book_entry(entry);
  }

  // génération des écritures de report cloture

  generate_next_season_entries(next_season: string): Observable<number> {
    let next_season_entries: BookEntry[] = [];

    // A. report des avoirs client
    let assets = this.get_customers_assets();

    let operations: Operation[] = [];
    let grand_total = 0;

    Array.from(assets)
      .filter(([member, { total, entries }]: [string, { total: number; entries: BookEntry[] }]) => total > 0)
      .forEach(([member, { total, entries }]: [string, { total: number; entries: BookEntry[] }]) => {
        operations.push({ member: member, label: 'report avoir antérieur', values: { [CUSTOMER_ACCOUNT.ASSET_credit]: total } });
        grand_total += total;
      }
      );


    let book_entry: BookEntry = {
      id: '',
      season: next_season,
      date: this.systemDataService.start_date(next_season),
      transaction_id: TRANSACTION_ID.report_avoir,
      amounts: { [BALANCE_ACCOUNT.BAL_debit]: grand_total },
      operations: operations,
    };

    console.log('report d\'avoir', book_entry);
    this.toastService.showInfoToast('report d\'avoir', (grand_total + ' € reportés sur la saison ' + next_season));
    next_season_entries.push(book_entry);



    // B.1 report des chèques  non pointés
    this._book_entries.filter((entry) => ((entry.transaction_id === TRANSACTION_ID.dépense_par_chèque)) && entry.bank_report === null)
      .forEach((entry) => {
        let amount = entry.amounts[FINANCIAL_ACCOUNT.BANK_credit];
        if (!amount) throw Error('montant du chèque non défini !?!?')
        let label = entry.operations.reduce((acc, op) => { return acc + op.label + ' ' }, entry.date.toString() + ':');;

        let book_entry: BookEntry = {
          id: '',
          season: next_season,
          date: this.systemDataService.start_date(next_season),
          transaction_id: TRANSACTION_ID.report_chèque,
          amounts: { [FINANCIAL_ACCOUNT.BANK_credit]: amount, [BALANCE_ACCOUNT.BAL_debit]: amount },
          cheque_ref: entry.cheque_ref,
          operations: [{ label: label, values: {} }],
        }

        // console.log('report des chèque', book_entry);
        next_season_entries.push(book_entry);

      });

    // B.2 report des prélèvements (charges constatées d'avance) non pointés
    this._book_entries.filter((entry) => ((entry.transaction_id === TRANSACTION_ID.dépense_par_prélèvement)) && entry.bank_report === null)
      .forEach((entry) => {
        let amount = entry.amounts[FINANCIAL_ACCOUNT.BANK_credit];
        if (!amount) throw Error('montant du chèque non défini !?!?')
        let label = entry.operations.reduce((acc, op) => { return acc + op.label + ' ' }, entry.date.toString() + ':');;

        let book_entry: BookEntry = {
          id: '',
          season: next_season,
          date: this.systemDataService.start_date(next_season),
          transaction_id: TRANSACTION_ID.report_prélèvement,
          amounts: { [FINANCIAL_ACCOUNT.BANK_credit]: amount, [BALANCE_ACCOUNT.BAL_debit]: amount },
          // cheque_ref: entry.cheque_ref,
          operations: [{ label: label, values: {} }],
        }

        // console.log('report des chèque', book_entry);
        next_season_entries.push(book_entry);

      });

    // C. report des dettes clients
    let debts = this.get_debts();
    if (Array.from(debts).length !== 0) {
      let operations: Operation[] = [];
      let grand_total = 0;
      Array.from(debts)
        .filter(([member, value]: [string, { total: number; entries: BookEntry[] }]) => value.total > 0)
        .forEach(([member, value]: [string, { total: number; entries: BookEntry[] }]) => {
          grand_total += value.total;
          operations.push({ member: member, label: 'report dette', values: { [CUSTOMER_ACCOUNT.DEBT_debit]: value.total } });
        });

      let book_entry: BookEntry = {
        id: '',
        season: next_season,
        date: this.systemDataService.start_date(next_season),
        transaction_id: TRANSACTION_ID.report_dette,
        amounts: { [BALANCE_ACCOUNT.BAL_credit]: grand_total },
        operations: operations,
      };

      // console.log('report de dettes', book_entry);
      next_season_entries.push(book_entry);
    }

    return this.book_entries_bulk_create$(next_season_entries);
  }

  Round(value: number) {
    const neat = +(Math.abs(value).toPrecision(15));
    const rounded = Math.round(neat * 100) / 100;
    return rounded * Math.sign(value);
  }

}
