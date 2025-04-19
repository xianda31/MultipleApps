import { Injectable } from '@angular/core';
import { generateClient } from 'aws-amplify/api';

import { BookEntry, Revenue, FINANCIAL_ACCOUNT, Expense, CUSTOMER_ACCOUNT, TRANSACTION_ID, bank_values, Operation, Liquidity } from '../../../common/accounting.interface';
import { Schema } from '../../../../amplify/data/resource';
import { BehaviorSubject, catchError, combineLatest, from, map, Observable, of, switchMap, tap } from 'rxjs';
import { SystemDataService } from '../../../common/services/system-data.service';
import { ToastService } from '../../../common/toaster/toast.service';
import { TransactionService } from './transaction.service';
import { TRANSACTION_CLASS } from '../../../common/transaction.definition';

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

  // trace_on: boolean = false; 

  constructor(
    private systemDataService: SystemDataService,
    private toastService: ToastService,
    private transactionService: TransactionService,
  ) {
  }

trace_on(): boolean {
    return this.systemDataService.trace_on();
  }

  jsonified_entry(entry: BookEntry): BookEntry_input {
    const replacer = (key: string, value: any) => {
      if (key === 'amounts' || key === 'values') {
        return JSON.stringify(value);
      }
      return value;
    }

    let stringified = JSON.stringify(entry, replacer);
    return JSON.parse(stringified) as BookEntry_input;
  }

  parsed_entry(entry: BookEntry_output): BookEntry {
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
        const response = await client.models.BookEntry.create(jsonified_entry_without_id);
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

  // extra_sanity_check(entries: BookEntry[]) {
  //   // check all book entries have a transaction id
  //   entries.forEach((book_entry, index) => {
  //     let transaction_id = book_entry.transaction_id;
  //     if (!transaction_id) {
  //       console.error('book entry nbr %s has a bad transaction id', index, book_entry.transaction_id);
  //       throw new Error('book entry has no transaction id');
  //     }
  //   });
  //   console.log('all book entries have a transaction id');
  // }

  // create

  async create_book_entry(book_entry: BookEntry) {
    const client = generateClient<Schema>();
    let jsonified_entry: BookEntry_input = this.jsonified_entry(book_entry);
    const { id, ...jsonified_entry_without_id } = jsonified_entry;
    try {
      const response = await client.models.BookEntry.create(jsonified_entry_without_id);
      if (response.errors) {
        console.error('error creating', this.jsonified_entry(book_entry), response.errors);
        throw new Error(JSON.stringify(response.errors));
      }
      const created_entry = this.parsed_entry(response.data as unknown as BookEntry_output);
      this._book_entries.push(created_entry);
      this._book_entries$.next(this._book_entries.sort((b, a) => {
        return a.date.localeCompare(b.date) === 0 ? (a.updatedAt ?? '').localeCompare(b.updatedAt ?? '') : a.date.localeCompare(b.date);
      }));
      return (created_entry);
    } catch (error) {
      console.error('error', error);
      throw new Error(error instanceof Error ? error.message : String(error));
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
      const response = await client.models.BookEntry.update(this.jsonified_entry(book_entry));
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
    } catch (error) {
      console.error('error', error);
      throw new Error(error instanceof Error ? error.message : String(error));
    }
  }

  // delete

  delete_book_entry(entry_id: string) {
    const client = generateClient<Schema>();

    return client.models.BookEntry.delete({ id: entry_id })
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
        console.error('error', error);
        throw new Error(error)
      });
  }

  // list

  list_book_entries$(season: string): Observable<BookEntry[]> {

    const fetchBookentries = async (_season: string): Promise<BookEntry[]> => {
      try {
        const client = generateClient<Schema>();
        let token: any = null;
        let nbloops = 0;
        let entries: BookEntry[] = [];
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
          let new_jsoned_entries = data as unknown as BookEntry_output[];
          // if (this.trace_on()) console.log('+ %s entries incrementally loaded from S3', data.length);
          entries = [...entries, ...new_jsoned_entries.map((entry) => this.parsed_entry(entry))];
          token = nextToken;

        } while (token !== null && nbloops++ < 10)

        if (token !== null) {
          this.toastService.showWarningToast('base comptabilité', 'beaucoup trop d\'entrées à charger , veuillez répeter l\'opération');
        }
        return entries;
      }
      catch (error) {
        console.error('error', error);
        throw new Error(error instanceof Error ? error.message : String(error));
      }
    }

    if (this._book_entries) {
      if (this.trace_on()) console.log('%s book entries retrieved from cache', this._book_entries.length);
    } else {
      // this._book_entries$.next([] as BookEntry[]);   // initialize behaviorSubject until the S3 fetch complete
      from(fetchBookentries(season)).subscribe((entries) => {
        this._book_entries = entries.sort((a, b) => {
          return a.date.localeCompare(b.date) === 0 ? (a.updatedAt ?? '').localeCompare(b.updatedAt ?? '') : a.date.localeCompare(b.date);
        });
        this._book_entries$.next(this._book_entries);
        if (this.trace_on()) console.log('%s book entries loaded from S3', entries.length);
      });
    }

    return this._book_entries$.asObservable();

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
            limit: 100,   // this is the default value anyway
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
    if(!this._book_entries) { // if no book entries are loaded yet
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
  
    if(!this._book_entries) { // if no book entries are loaded yet
      return [] as Revenue[]  
    }

    return this._book_entries
      .filter(book_entry => [TRANSACTION_CLASS.OTHER_REVENUE, TRANSACTION_CLASS.REVENUE_FROM_MEMBER].includes(this.transactionService.transaction_class(book_entry.transaction_id)))
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

    if(!this._book_entries) { // if no book entries are loaded yet
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

  get_cashbox_movements_amount(): number {
    if(this._book_entries === undefined) { // if no book entries are loaded yet
      return 0; 
    }

    // debug purpoise

    // let _in = this._book_entries.reduce((acc, book_entry) => {
    //   return acc + (book_entry.amounts[FINANCIAL_ACCOUNT.CASHBOX_debit] || 0);
    // }, 0);
    // let nb_in = this._book_entries.reduce((acc, book_entry) => {
    //   return acc + ((book_entry.amounts[FINANCIAL_ACCOUNT.CASHBOX_debit] || 0) > 0 ? 1 : 0);
    // }, 0);
    
    // let _out = this._book_entries.reduce((acc, book_entry) => {
    //   return acc + (book_entry.amounts[FINANCIAL_ACCOUNT.CASHBOX_credit] || 0);
    // }, 0);
    // console.log('nb_in', nb_in, 'in : ', _in, 'out : ', _out, 'total : ', _in - _out);

    // end debug purpoise

    return this.Round(this._book_entries.reduce((acc, book_entry) => {
      return acc + (book_entry.amounts[FINANCIAL_ACCOUNT.CASHBOX_debit] || 0) - (book_entry.amounts[FINANCIAL_ACCOUNT.CASHBOX_credit] || 0);
    }, 0));
  }
  get_bank_movements_amount(): number {
    if(this._book_entries === undefined) { // if no book entries are loaded yet
      return 0; // no outstanding expenses
    }
    return this.Round(this._book_entries.reduce((acc, book_entry) => {
      return acc + (book_entry.amounts[FINANCIAL_ACCOUNT.BANK_debit] || 0) - (((book_entry.bank_report !== null) ? (book_entry.amounts[FINANCIAL_ACCOUNT.BANK_credit] || 0) : 0));
    }, 0));
  }
  get_bank_outstanding_expenses_amount(): number {
    if(this._book_entries === undefined) { // if no book entries are loaded yet
      return 0; // no outstanding expenses
    }
    return this.Round(this._book_entries.reduce((acc, book_entry) => {
      return acc + (((book_entry.bank_report === null)&& (book_entry.transaction_id === TRANSACTION_ID.dépense_par_chèque) ) ? (book_entry.amounts[FINANCIAL_ACCOUNT.BANK_credit] || 0) : 0);
    }, 0));
  }

  get_savings_movements_amount(): number {
    if(this._book_entries === undefined) { // if no book entries are loaded yet
      return 0; // no outstanding expenses
    }
    return this.Round(this._book_entries.reduce((acc, book_entry) => {
      return acc + (book_entry.amounts[FINANCIAL_ACCOUNT.SAVING_debit] || 0) - (book_entry.amounts[FINANCIAL_ACCOUNT.SAVING_credit] || 0);
    }, 0));
  }

  get_bank_outstanding_expenses():  BookEntry[] {
    if(this._book_entries === undefined) { // if no book entries are loaded yet
      return []; 
    }
    let entries = (this._book_entries.filter((book_entry) => {
       ((!book_entry.bank_report || book_entry.bank_report === null) && (book_entry.transaction_id === TRANSACTION_ID.dépense_par_chèque) );
    }));
    return entries;
  }

  get_debts(): Map<string, number> {
    let debt = new Map<string, number>();

    if(this._book_entries === undefined) { // if no book entries are loaded yet
      return debt; 
    }
    
    this._book_entries.forEach((book_entry) => {
      book_entry.operations.forEach((op) => {
        if (op.values[CUSTOMER_ACCOUNT.DEBT_debit]) {
          let name = op.member;   // member is the name of the debt owner & payee
          if (!name) throw new Error('no member name found');
          debt.set(name, (debt.get(name) || 0) + op.values[CUSTOMER_ACCOUNT.DEBT_debit]);
        }
        if (op.values[CUSTOMER_ACCOUNT.DEBT_credit]) {
          let name = op.member;   // member is the name of the debt owner & payee
          if (!name) throw new Error('no member name found');
          debt.set(name, (debt.get(name) || 0) - op.values[CUSTOMER_ACCOUNT.DEBT_credit]);
        }
      });
    });
    // console.log('%s debt is : ', member_full_name, debt.get(member_full_name) || 0);
    return debt;

  }


  get_clients_debit_value(): number {  // dettes clients

    if(this._book_entries === undefined) { // if no book entries are loaded yet
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


  // avoir clients :
  get_customers_assets(): Map<string, { total: number, entries: BookEntry[] }> {

    if(this._book_entries === undefined) { // if no book entries are loaded yet
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
    return debts.get(member_full_name) || 0;

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
    if(!this._book_entries) { // if no book entries are loaded yet
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


  get_expenses_movements_amount(): number {
    return this.Round(this.get_expenses().reduce((acc, op) => {
      return acc + this.sum_values(op.values);
    }
      , 0));
  }

  sum_values(values: { [key: string]: number }): number {
    return Object.values(values).reduce((acc, value) => acc + value, 0);
  }

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
    let amounts: bank_values = {};
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
      // return Object.values(values).reduce((acc, value) => acc + value, 0);
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
      // return Object.values(values).reduce((acc, value) => acc + value, 0);
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

  get_profit_and_loss_result(): number {
    return this.Round(this.get_total_revenues() - this.get_total_expenses());
  }

  Round(value: number) {
    const neat = +(Math.abs(value).toPrecision(15));
    const rounded = Math.round(neat * 100) / 100;
    return rounded * Math.sign(value);
  }
}
