import { Injectable } from '@angular/core';
import { generateClient } from 'aws-amplify/api';

import { Financial, Revenue, FINANCIALS, Expense, RECORD_CLASS } from '../../../common/new_sales.interface';
import { Schema } from '../../../../amplify/data/resource';
import { BehaviorSubject, from, map, Observable, of, switchMap, tap } from 'rxjs';

type Financial_input = Schema['Financial']['type'];
type Financial_output = Financial & {
  createdAt: Date,
  updatedAt: Date,
}
@Injectable({
  providedIn: 'root'
})
export class BookService {

  private _financials!: Financial[];
  private _financials$ = new BehaviorSubject<Financial[]>(this._financials);
  constructor() { }

  jsonified_entry(entry: Financial): Financial_input {
    const replacer = (key: string, value: any) => {
      if (key === 'amounts' || key === 'values') {
        return JSON.stringify(value);
      }
      return value;
    }

    let stringified = JSON.stringify(entry, replacer);
    return JSON.parse(stringified) as Financial_input;
  }

  parsed_entry(entry: Financial_output): Financial {
    const replacer = (key: string, value: any) => {
      if (key === 'amounts' || key === 'values') {
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
    let jsonified_entry: Financial_input = this.jsonified_entry(financial);
    const { id, ...jsonified_entry_without_id } = jsonified_entry;
    // console.log('jsonified_entry', jsonified_entry);
    try {
      const response = await client.models.Financial.create(jsonified_entry_without_id);
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
        { selectionSet: ['id', 'season', 'date', 'amounts', 'operations.*', 'class', 'bank_op_type', 'cheque_ref', 'deposit_ref', 'bank_report'] }
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
  async update_financial(financial: Financial) {
    const client = generateClient<Schema>();
    const jsonified_entry: Financial_input = this.jsonified_entry(financial);

    try {
      const response = await client.models.Financial.update(this.jsonified_entry(financial));
      if (response.errors) {
        console.error('error', response.errors);
        throw new Error(JSON.stringify(response.errors));
      }
      const updated_entry = this.parsed_entry(response.data as unknown as Financial_output);
      this._financials = this._financials.map((entry) => entry.id === updated_entry.id ? updated_entry : entry);
      this._financials$.next(this._financials.sort((a, b) => a.date.localeCompare(b.date)));
      return updated_entry;
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

  list_financials$(season?: string): Observable<Financial[]> {

    const fetchFinancials = async () => {
      const client = generateClient<Schema>();
      const { data, errors } = await client.models.Financial.list({
        filter: season ? { season: { eq: season } } : undefined
      });
      if (errors) {
        console.error(errors);
        throw new Error(JSON.stringify(errors));
      }
      this._financials = (data as unknown as Financial_output[])
        .map((entry) => this.parsed_entry(entry as Financial_output))
        .sort((a, b) => a.date.localeCompare(b.date));
      return this._financials;
    };
    console.log('fetching financials from ', this._financials ? 'cache' : 'server');
    let remote_load$ = from(fetchFinancials()).pipe(
      tap((financials) => {
        this._financials = financials;
        // console.log('financials %s element(s) loaded from AWS', financials.length);
        this._financials$.next(financials);
      }),
      switchMap(() => this._financials$.asObservable())
    );

    return this._financials ? this._financials$.asObservable() : remote_load$;
  }

  // utility functions



  get_revenues(): Revenue[] {
    return this._financials
      .filter(financial => financial.class === RECORD_CLASS.REVENUE_FROM_MEMBER || financial.class === RECORD_CLASS.OTHER_REVENUE)
      .reduce((acc, financial) => {
        const revenues = financial.operations
          .map(op => ({
            ...op,
            season: financial.season,
            date: financial.date,
            id: financial.id,
          } as Revenue));
        return [...acc, ...revenues];
      }, [] as Revenue[]);
  }

  get_revenues_from_members(): Revenue[] {
    return this._financials
      .filter(financial => financial.class === RECORD_CLASS.REVENUE_FROM_MEMBER)
      .reduce((acc, financial) => {
        const revenues = financial.operations
          .map(op => ({
            ...op,
            season: financial.season,
            date: financial.date,
            id: financial.id,
          } as Revenue));
        return [...acc, ...revenues];
      }, [] as Revenue[]);
  }


  find_debt(member_full_name: string): number {
    let debt = new Map<string, number>();
    this._financials.forEach((financial) => {

      if (financial.amounts[FINANCIALS.DEBT_debit]) {
        let name = financial.operations[0].member;   // member is the name of the debt owner & payee
        if (!name) throw new Error('no member name found');
        debt.set(name, (debt.get(name) || 0) + financial.amounts[FINANCIALS.DEBT_debit]);
      }
      if (financial.amounts[FINANCIALS.DEBT_credit]) {
        let name = financial.operations[0].member;   // member is the name of the debt owner & payee
        if (!name) throw new Error('no member name found');
        debt.set(name, (debt.get(name) || 0) - financial.amounts[FINANCIALS.DEBT_credit]);
      }

    });
    // console.log('%s debt is : ', member_full_name, debt.get(member_full_name) || 0);
    return debt.get(member_full_name) || 0;

  }

  find_assets(member_full_name: string): number {
    let assets = new Map<string, number>();
    this._financials.forEach((financial) => {

      if (financial.amounts[FINANCIALS.ASSET_debit]) {
        let name = financial.operations[0].member;   // member is the name of the asset owner & payer
        if (!name) throw new Error('no member name found');
        assets.set(name, (assets.get(name) || 0) - financial.amounts[FINANCIALS.ASSET_debit]);
      }
      if (financial.amounts[FINANCIALS.ASSET_credit]) {
        let name = financial.operations[0].member;
        if (!name) throw new Error('no member name found');
        assets.set(name, (assets.get(name) || 0) + financial.amounts[FINANCIALS.ASSET_credit]);
      }

    });
    // console.log('%s assets is : ', member_full_name, assets.get(member_full_name) || 0);
    return assets.get(member_full_name) || 0;
  }


  get_expenses(): Expense[] {
    return this._financials
      .filter(financial => financial.class === RECORD_CLASS.EXPENSE)
      .reduce((acc, financial) => {
        const expenses = financial.operations
          .map(op => ({
            ...op,
            season: financial.season,
            date: financial.date,
            id: financial.id,
          } as Expense));
        return [...acc, ...expenses];
      }, [] as Expense[]);
  }


}