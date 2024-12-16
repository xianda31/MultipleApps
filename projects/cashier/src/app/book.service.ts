import { Injectable } from '@angular/core';
import { generateClient } from 'aws-amplify/api';

import { Financial } from '../../../common/new_sales.interface';
import { Schema } from '../../../../amplify/data/resource';
import { BehaviorSubject, from, map, Observable, switchMap, tap } from 'rxjs';

type Financial_input = Schema['Financial']['type'];
type Financial_output = Financial & {
  createdAt: Date,
  updatedAt: Date,
}
@Injectable({
  providedIn: 'root'
})
export class BookService {

  private _financials: Financial[] = [];
  private _financials$ = new BehaviorSubject<Financial[]>(this._financials);
  constructor() { }

  jsonified_entry(entry: Financial): Financial_input {
    const replacer = (key: string, value: any) => {
      if (key === 'amounts') {
        return JSON.stringify(value);
      }
      return value
    }

    let stringified = JSON.stringify(entry, replacer);
    return JSON.parse(stringified) as Financial_input;
  }

  parsed_entry(entry: Financial_output): Financial {
    const replacer = (key: string, value: any) => {
      if (key === 'amounts') {
        return JSON.parse(value);
      }
      return value
    }

    let destringified = JSON.stringify(entry, replacer);
    return JSON.parse(destringified) as Financial;

  }

  // CRUD(L) Financial

  async create_financial(financial: Financial) {
    const client = generateClient<Schema>();
    const jsonified_entry: Financial_input = this.jsonified_entry(financial);
    // console.log('jsonified_entry', jsonified_entry);
    try {
      const response = await client.models.Financial.create(this.jsonified_entry(financial));
      if (response.errors) {
        console.error('error creating', this.jsonified_entry(financial), response.errors);
        throw new Error(JSON.stringify(response.errors));
      }
      const created_entry = this.parsed_entry(response.data as unknown as Financial_output);
      this._financials.push(created_entry);
      this._financials$.next(this._financials.sort((a, b) => a.date.localeCompare(b.date)));
      return (created_entry);
    } catch (error) {
      console.error('error', error);
      throw new Error(error instanceof Error ? error.message : String(error));
    }
  }

  async read_financial(entry_id: string) {
    const client = generateClient<Schema>();

    try {
      const response = await client.models.Financial.get(
        { id: entry_id },
        { selectionSet: ['id', 'season', 'date', 'amounts', 'operations.*', 'cheque_ref', 'deposit_ref', 'bank_report'] }
      );
      if (response.errors) {
        console.error('error', response.errors);
        throw new Error(JSON.stringify(response.errors));
      }
      return this.parsed_entry(response.data as unknown as Financial_output);
    } catch (error) {
      console.error('error', error);
      throw new Error(error instanceof Error ? error.message : String(error));
    }
  }



  delete_financial(entry_id: string) {
    const client = generateClient<Schema>();

    return client.models.Financial.delete({ id: entry_id })
      .then((response) => {
        if (response.errors) {
          console.error('error', response.errors);
          throw new Error(JSON.stringify(response.errors));
        }
        this._financials = this._financials.filter((entry) => entry.id !== entry_id);
        this._financials$.next(this._financials.sort((a, b) => a.date.localeCompare(b.date)));
        return response;
      })
      .catch((error) => {
        console.error('error', error);
        throw new Error(error)
      });
  }

  list_financials$(): Observable<Financial[]> {
    const client = generateClient<Schema>();

    return from(client.models.Financial.list()).pipe(
      map((response: { data: unknown }) => response.data as Financial_output[]),
      tap((financials) => {
        this._financials = financials.map((entry) => this.parsed_entry(entry));
        this._financials$.next(this._financials.sort((a, b) => a.date.localeCompare(b.date)));
      }),
      switchMap(() => this._financials$.asObservable())
    );
  }


}
