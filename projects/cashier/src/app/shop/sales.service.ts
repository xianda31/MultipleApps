import { Injectable } from '@angular/core';
import { generateClient } from 'aws-amplify/api';
import { Schema } from '../../../../../amplify/data/resource';
import { combineLatest, from, map, Observable, of, switchMap, tap } from 'rxjs';
import { Revenue, Sale, SaleItem } from './sales.interface';

@Injectable({
  providedIn: 'root'
})
export class SalesService {

  private _sales!: Sale[];
  private _saleItems: SaleItem[] = [];
  current_season: string = '';

  constructor(
  ) { }


  // saleItems API

  writeSaleItems(saleItems: SaleItem[], sale_id: string): Observable<SaleItem[]> {
    let observables: Observable<SaleItem>[] = [];

    let writeSaleItem: (saleItem: SaleItem, sale_id: string) => Observable<SaleItem> = (saleItem, sale_id) => {
      const client = generateClient<Schema>();
      let { ...saleItemCreateInput } = { ...saleItem, sale_id };
      // console.log('saleItemCreateInput', saleItemCreateInput);
      return from(client.models.SaleItem.create(saleItemCreateInput))
        .pipe(
          map((response: { data: unknown; }) => response.data as unknown as SaleItem),
          tap((saleItem) => { this._saleItems.push(saleItem) })
        );
    };

    saleItems.forEach((saleItem) => {
      observables.push(writeSaleItem(saleItem, sale_id));
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
          map((response: { data: SaleItem[] }) => response.data),
          tap((saleItems) => {
            this._saleItems = saleItems;
          })
        );
    }
    return (this._saleItems.length > 0 && !new_season) ? of(this._saleItems) : _listSaleItems();
  }


  // Revenues API

  getRevenues(season: string): Observable<Revenue[]> {
    const client = generateClient<Schema>();
    return from(client.models.Revenue.list(
      {
        filter: { season: { eq: season } },
      }
    ))
      .pipe(
        map((response: { data: any }) => response.data as unknown as Revenue[])
      );
  }

  writeRevenues(revenues: Revenue[], sale_id: string): Observable<Revenue[]> {
    let observables: Observable<Revenue>[] = [];

    let writeRevenue: (revenue: Revenue) => Observable<Revenue> = (revenue) => {
      let { ...revenueCreateInput } = { ...revenue, sale_id };
      const client = generateClient<Schema>();
      return from(client.models.Revenue.create(revenueCreateInput))
        .pipe(
          map((response: { data: unknown }) => response.data as unknown as Revenue),
          tap((revenue) => { })
        );
    };

    revenues.forEach((revenue) => {
      observables.push(writeRevenue(revenue));
    });

    return combineLatest(observables)
  }

  // sale API

  writeOperation(sale: Sale): Observable<[SaleItem[], Revenue[]]> {

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
          return combineLatest([
            this.writeSaleItems(sale.saleItems, sale.id!),
            this.writeRevenues(sale.revenues, sale.id!)
          ]);
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
          selectionSet: ['id', 'amount', 'season', 'vendor', 'event', 'payer_id', 'saleItems.*'],
          filter: { season: { eq: season } },
        })).pipe(
          map((response: { data: unknown; }) => response.data as unknown as Sale[]),
          tap((sales) => {
            this._sales = sales;
          })
        );
    }

    return (this._sales && !new_season) ? of(this._sales) : _listSales();
  }


}