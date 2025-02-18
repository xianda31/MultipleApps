import { Injectable } from '@angular/core';
import { generateClient } from 'aws-amplify/api';

import { BookEntry, Revenue, FINANCIAL_ACCOUNT, Expense, BOOK_ENTRY_CLASS, CUSTOMER_ACCOUNT } from '../../../common/accounting.interface';
import { Schema } from '../../../../amplify/data/resource';
import { BehaviorSubject, from, map, Observable, of, switchMap, tap } from 'rxjs';

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
  private _book_entries$ = new BehaviorSubject<BookEntry[]>(this._book_entries);
  constructor() { }

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

  async create_book_entry(book_entry: BookEntry) {
    const client = generateClient<Schema>();
    let jsonified_entry: BookEntry_input = this.jsonified_entry(book_entry);
    const { id, ...jsonified_entry_without_id } = jsonified_entry;
    // console.log('jsonified_entry', jsonified_entry);
    try {
      const response = await client.models.BookEntry.create(jsonified_entry_without_id);
      if (response.errors) {
        console.error('error creating', this.jsonified_entry(book_entry), response.errors);
        throw new Error(JSON.stringify(response.errors));
      }
      const created_entry = this.parsed_entry(response.data as unknown as BookEntry_output);
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
      const response = await client.models.BookEntry.get(
        { id: entry_id },
        { selectionSet: ['id', 'season', 'date', 'amounts', 'operations.*', 'class', 'bank_op_type', 'cheque_ref', 'deposit_ref', 'bank_report'] }
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
  async update_book_entry(book_entry: BookEntry) {
    const client = generateClient<Schema>();
    const jsonified_entry: BookEntry_input = this.jsonified_entry(book_entry);

    try {
      const response = await client.models.BookEntry.update(this.jsonified_entry(book_entry));
      if (response.errors) {
        console.error('error', response.errors);
        throw new Error(JSON.stringify(response.errors));
      }
      const updated_entry = this.parsed_entry(response.data as unknown as BookEntry_output);
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

    return client.models.BookEntry.delete({ id: entry_id })
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

  list_book_entries$(season?: string): Observable<BookEntry[]> {

    const fetchBookentries = async () => {
      const client = generateClient<Schema>();
      const { data, errors } = await client.models.BookEntry.list({
        filter: season ? { season: { eq: season } } : undefined
      });
      if (errors) {
        console.error(errors);
        throw new Error(JSON.stringify(errors));
      }
      this._book_entries = (data as unknown as BookEntry_output[])
        .map((entry) => this.parsed_entry(entry as BookEntry_output))
        .sort((a, b) => {
          return a.date.localeCompare(b.date) === 0 ? (a.updatedAt ?? '').localeCompare(b.updatedAt ?? '') : a.date.localeCompare(b.date);
        });
      return this._book_entries;
    };
    // console.log('fetching book_entries from ', this._book_entries ? 'cache' : 'server');
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

  get_operations(): (Revenue | Expense)[] {
    return this._book_entries
      .reduce((acc, book_entry) => {
        const revenues = book_entry.operations
          .map(op => ({
            ...op,
            season: book_entry.season,
            date: book_entry.date,
            id: book_entry.id,
          } as Revenue));
        return [...acc, ...revenues];
      }, [] as (Revenue | Expense)[]);
  }

  get_revenues(): Revenue[] {
    return this._book_entries
      .filter(book_entry => book_entry.class === BOOK_ENTRY_CLASS.a_REVENUE_FROM_MEMBER || book_entry.class === BOOK_ENTRY_CLASS.c_OTHER_REVENUE)
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
      .filter(book_entry => book_entry.class === BOOK_ENTRY_CLASS.a_REVENUE_FROM_MEMBER)
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

  get_cashbox_amount(): number {
    return this._book_entries.reduce((acc, book_entry) => {
      return acc + (book_entry.amounts[FINANCIAL_ACCOUNT.CASHBOX_debit] || 0) - (book_entry.amounts[FINANCIAL_ACCOUNT.CASHBOX_credit] || 0);
    }
      , 0);
  }
  get_debts(): Map<string, number> {
    let debt = new Map<string, number>();
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

  get_assets(): Map<string, number> {
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
    return assets;
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
    return this._book_entries
      .filter(book_entry => book_entry.class === BOOK_ENTRY_CLASS.b_OTHER_EXPENSE || book_entry.class === BOOK_ENTRY_CLASS.d_EXPENSE_FOR_MEMBER)
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

  update_deposit_refs(deposit_ref: string, new_deposit_ref: string) {
    this._book_entries.forEach((entry) => {
      if (entry.deposit_ref === deposit_ref) {
        entry.deposit_ref = new_deposit_ref;
      }
    });
    this._book_entries$.next(this._book_entries);
  }
}