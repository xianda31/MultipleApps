import { Injectable } from '@angular/core';
import { generateClient } from 'aws-amplify/api';
import { Schema } from '../../../../../amplify/data/resource';
import { combineLatest, from, map, Observable, of, switchMap, tap } from 'rxjs';
import { Sale, SaleItem } from './sales.interface';

@Injectable({
  providedIn: 'root'
})
export class SalesService {

  private _sales!: Sale[];
  private _saleItems!: SaleItem[];
  current_season: string = '';

  constructor(
  ) { }

  writeSaleItems(sale: Sale): Observable<SaleItem[]> {
    let observables: Observable<SaleItem>[] = [];

    let writeSaleItem: (saleItem: SaleItem, sale_id: string) => Observable<SaleItem> = (saleItem, sale_id) => {
      const client = generateClient<Schema>();
      let { ...saleWithSaleId } = { ...saleItem, sale_id };
      // console.log('saleWithSaleId', saleWithSaleId);
      return from(client.models.SaleItem.create(saleWithSaleId))
        .pipe(
          map((response: { data: unknown; }) => response.data as unknown as SaleItem),
        );
    };

    sale.saleItems.forEach((saleItem) => {
      observables.push(writeSaleItem(saleItem, sale.id!));
    });

    return combineLatest(observables)
  }

  getSaleItems(season: string): Observable<SaleItem[]> {
    let new_season = false;
    if (this.current_season !== season) {
      new_season = true;
      this.current_season = season;
    }

    const _listSaleItems = (): Observable<SaleItem[]> => {
      const client = generateClient<Schema>();
      return from(client.models.SaleItem.list(
        {
          filter: { season: { eq: season } },
        }
      ))
        .pipe(
          tap((response) => console.log('response.data', response.data)),
          map((response: { data: SaleItem[]; }) => response.data),
          tap((saleItems) => {
            console.log('saleItems', saleItems);
            this._saleItems = saleItems;
          })
        );
    }
    return (this._saleItems && !new_season) ? of(this._saleItems) : _listSaleItems();
  }

  writeOperation(sale: Sale): Observable<SaleItem[]> {

    console.log('sale', sale);

    const client = generateClient<Schema>();
    const { saleItems, ...saleInput } = sale;
    // console.log('saleInput', saleInput);
    return from(client.models.Sale.create(saleInput))
      .pipe(
        map((response: { data: unknown; }) => {
          let new_sale = response.data as unknown as Sale;
          if (!new_sale || !new_sale.id) {
            throw new Error('sale writing not performed' + JSON.stringify(response));
          } else {
            sale.id = new_sale.id;
            if (this._sales) this._sales.push(sale);
            return sale;
          }
        }),
        switchMap((sale) => {
          return this.writeSaleItems(sale)
        })

      );
  }

  getSale(sale_id: string): Sale | undefined {
    return this._sales.find((sale) => sale.id === sale_id);
  }

  getSales(season: string): Observable<Sale[]> {
    let new_season = false;
    if (this.current_season !== season) {
      new_season = true;
      this.current_season = season;
    }

    const _listSales = (): Observable<Sale[]> => {
      const client = generateClient<Schema>();
      return from(client.models.Sale.list(
        {
          // selectionSet: ['id', 'amount', 'payer_id',  'payment.*'],
          filter: { season: { eq: season } },
        })).pipe(
          tap((response) => console.log('response.data', response.data)),

          map((response: { data: unknown; }) => response.data as unknown as Sale[]),
          tap((sales) => {
            this._sales = sales;
          })
        );
    }

    return (this._sales && !new_season) ? of(this._sales) : _listSales();
  }


}