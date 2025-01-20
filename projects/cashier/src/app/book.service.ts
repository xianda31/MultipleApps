import { Injectable } from '@angular/core';
import { generateClient } from 'aws-amplify/api';

import { Bookentry, Revenue, FINANCIAL_ACCOUNTS, Expense, RECORD_CLASS } from '../../../common/accounting.interface';
import { Schema } from '../../../../amplify/data/resource';
import { BehaviorSubject, from, map, Observable, of, switchMap, tap } from 'rxjs';

type Bookentry_input = Schema['Bookentry']['type'];
type Bookentry_output = Bookentry & {
  createdAt: Date,
  updatedAt: Date,
}
@Injectable({
  providedIn: 'root'
})
export class BookService {

  private _book_entries!: Bookentry[];
  private _book_entries$ = new BehaviorSubject<Bookentry[]>(this._book_entries);
  constructor() { }

  jsonified_entry(entry: Bookentry): Bookentry_input {
    const replacer = (key: string, value: any) => {
      if (key === 'amounts' || key === 'values') {
        return JSON.stringify(value);
      }
      return value;
    }

    let stringified = JSON.stringify(entry, replacer);
    return JSON.parse(stringified) as Bookentry_input;
  }

  parsed_entry(entry: Bookentry_output): Bookentry {
    const replacer = (key: string, value: any) => {
      if (key === 'amounts' || key === 'values') {
        return JSON.parse(value);
      }
      return value
    }

    let destringified = JSON.stringify(entry, replacer);
    return JSON.parse(destringified) as Bookentry;

  }

  // CRUD(L) Bookentry

  async create_book_entry(book_entry: Bookentry) {
    const client = generateClient<Schema>();
    let jsonified_entry: Bookentry_input = this.jsonified_entry(book_entry);
    const { id, ...jsonified_entry_without_id } = jsonified_entry;
    // console.log('jsonified_entry', jsonified_entry);
    try {
      const response = await client.models.Bookentry.create(jsonified_entry_without_id);
      if (response.errors) {
        console.error('error creating', this.jsonified_entry(book_entry), response.errors);
        throw new Error(JSON.stringify(response.errors));
      }
      const created_entry = this.parsed_entry(response.data as unknown as Bookentry_output);
      this._book_entries.push(created_entry);
      this._book_entries$.next(this._book_entries.sort((a, b) => a.date.localeCompare(b.date)));
      return (created_entry);
    } catch (error) {
      console.error('error', error);
      throw new Error(error instanceof Error ? error.message : String(error));
    }
  }

  async read_book_entry(entry_id: string) {
    const client = generateClient<Schema>();

    try {
      const response = await client.models.Bookentry.get(
        { id: entry_id },
        { selectionSet: ['id', 'season', 'date', 'amounts', 'operations.*', 'class', 'bank_op_type', 'cheque_ref', 'deposit_ref', 'bank_report'] }
      );
      if (response.errors) {
        console.error('error', response.errors);
        throw new Error(JSON.stringify(response.errors));
      }
      return this.parsed_entry(response.data as unknown as Bookentry_output);
    } catch (error) {
      console.error('error', error);
      throw new Error(error instanceof Error ? error.message : String(error));
    }
  }
  async update_book_entry(book_entry: Bookentry) {
    const client = generateClient<Schema>();
    const jsonified_entry: Bookentry_input = this.jsonified_entry(book_entry);

    try {
      const response = await client.models.Bookentry.update(this.jsonified_entry(book_entry));
      if (response.errors) {
        console.error('error', response.errors);
        throw new Error(JSON.stringify(response.errors));
      }
      const updated_entry = this.parsed_entry(response.data as unknown as Bookentry_output);
      this._book_entries = this._book_entries.map((entry) => entry.id === updated_entry.id ? updated_entry : entry);
      this._book_entries$.next(this._book_entries.sort((a, b) => {
        return a.date.localeCompare(b.date) === 0 ? (a.updatedAt ?? '').localeCompare(b.updatedAt ?? '') : a.date.localeCompare(b.date);
      }));
      return updated_entry;
    } catch (error) {
      console.error('error', error);
      throw new Error(error instanceof Error ? error.message : String(error));
    }
  }



  delete_book_entry(entry_id: string) {
    const client = generateClient<Schema>();

    return client.models.Bookentry.delete({ id: entry_id })
      .then((response) => {
        if (response.errors) {
          console.error('error', response.errors);
          throw new Error(JSON.stringify(response.errors));
        }
        this._book_entries = this._book_entries.filter((entry) => entry.id !== entry_id);
        this._book_entries$.next(this._book_entries.sort((a, b) => {
          return a.date.localeCompare(b.date) === 0 ? (a.updatedAt ?? '').localeCompare(b.updatedAt ?? '') : a.date.localeCompare(b.date);
        }));
        return response;
      })
      .catch((error) => {
        console.error('error', error);
        throw new Error(error)
      });
  }

  list_book_entries$(season?: string): Observable<Bookentry[]> {

    const fetchBookentries = async () => {
      const client = generateClient<Schema>();
      const { data, errors } = await client.models.Bookentry.list({
        filter: season ? { season: { eq: season } } : undefined
      });
      if (errors) {
        console.error(errors);
        throw new Error(JSON.stringify(errors));
      }
      this._book_entries = (data as unknown as Bookentry_output[])
        .map((entry) => this.parsed_entry(entry as Bookentry_output))
        .sort((a, b) => {
          return a.date.localeCompare(b.date) === 0 ? (a.updatedAt ?? '').localeCompare(b.updatedAt ?? '') : a.date.localeCompare(b.date);
        });
      return this._book_entries;
    };
    console.log('fetching book_entries from ', this._book_entries ? 'cache' : 'server');
    let remote_load$ = from(fetchBookentries()).pipe(
      tap((book_entries) => {
        this._book_entries = book_entries;
        // console.log('book_entries %s element(s) loaded from AWS', book_entries.length);
        this._book_entries$.next(book_entries);
      }),
      switchMap(() => this._book_entries$.asObservable())
    );

    return this._book_entries ? this._book_entries$.asObservable() : remote_load$;
  }

  // utility functions



  get_revenues(): Revenue[] {
    return this._book_entries
      .filter(book_entry => book_entry.class === RECORD_CLASS.REVENUE_FROM_MEMBER || book_entry.class === RECORD_CLASS.OTHER_REVENUE)
      .reduce((acc, book_entry) => {
        const revenues = book_entry.operations
          .map(op => ({
            ...op,
            season: book_entry.season,
            date: book_entry.date,
            id: book_entry.id,
          } as Revenue));
        return [...acc, ...revenues];
      }, [] as Revenue[]);
  }

  get_revenues_from_members(): Revenue[] {
    return this._book_entries
      .filter(book_entry => book_entry.class === RECORD_CLASS.REVENUE_FROM_MEMBER)
      .reduce((acc, book_entry) => {
        const revenues = book_entry.operations
          .map(op => ({
            ...op,
            season: book_entry.season,
            date: book_entry.date,
            id: book_entry.id,
          } as Revenue));
        return [...acc, ...revenues];
      }, [] as Revenue[]);
  }


  find_debt(member_full_name: string): number {
    let debt = new Map<string, number>();
    this._book_entries.forEach((book_entry) => {

      if (book_entry.amounts[FINANCIAL_ACCOUNTS.DEBT_debit]) {
        let name = book_entry.operations[0].member;   // member is the name of the debt owner & payee
        if (!name) throw new Error('no member name found');
        debt.set(name, (debt.get(name) || 0) + book_entry.amounts[FINANCIAL_ACCOUNTS.DEBT_debit]);
      }
      if (book_entry.amounts[FINANCIAL_ACCOUNTS.DEBT_credit]) {
        let name = book_entry.operations[0].member;   // member is the name of the debt owner & payee
        if (!name) throw new Error('no member name found');
        debt.set(name, (debt.get(name) || 0) - book_entry.amounts[FINANCIAL_ACCOUNTS.DEBT_credit]);
      }

    });
    // console.log('%s debt is : ', member_full_name, debt.get(member_full_name) || 0);
    return debt.get(member_full_name) || 0;

  }

  find_assets(member_full_name: string): number {
    let assets = new Map<string, number>();
    this._book_entries.forEach((book_entry) => {

      if (book_entry.amounts[FINANCIAL_ACCOUNTS.ASSET_debit]) {
        let name = book_entry.operations[0].member;   // member is the name of the asset owner & payer
        if (!name) throw new Error('no member name found');
        assets.set(name, (assets.get(name) || 0) - book_entry.amounts[FINANCIAL_ACCOUNTS.ASSET_debit]);
      }
      if (book_entry.amounts[FINANCIAL_ACCOUNTS.ASSET_credit]) {
        let name = book_entry.operations[0].member;
        if (!name) throw new Error('no member name found');
        assets.set(name, (assets.get(name) || 0) + book_entry.amounts[FINANCIAL_ACCOUNTS.ASSET_credit]);
      }

    });
    // console.log('%s assets is : ', member_full_name, assets.get(member_full_name) || 0);
    return assets.get(member_full_name) || 0;
  }


  get_expenses(): Expense[] {
    return this._book_entries
      .filter(book_entry => book_entry.class === RECORD_CLASS.EXPENSE)
      .reduce((acc, book_entry) => {
        const expenses = book_entry.operations
          .map(op => ({
            ...op,
            season: book_entry.season,
            date: book_entry.date,
            id: book_entry.id,
          } as Expense));
        return [...acc, ...expenses];
      }, [] as Expense[]);
  }


}