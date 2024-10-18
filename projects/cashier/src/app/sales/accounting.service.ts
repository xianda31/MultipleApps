import { Injectable } from '@angular/core';
import { Payment, Sale, SaleItem } from '../cart/cart.interface';
import { generateClient } from 'aws-amplify/api';
import { Schema } from '../../../../../amplify/data/resource';
import { combineLatest, from, map, Observable, of, switchMap, tap } from 'rxjs';
import { CartService } from '../cart.service';

@Injectable({
  providedIn: 'root'
})
export class AccountingService {

  private _sales!: Sale[];
  private _saleItems!: SaleItem[];
  current_season: string = '';

  constructor(
    private cartService: CartService
  ) { }

  writeSaleItems(sale: Sale): Observable<SaleItem[]> {
    let observables: Observable<SaleItem>[] = [];

    let writeSaleItem: (saleItem: SaleItem, sale_id: string) => Observable<SaleItem> = (saleItem, sale_id) => {

      const client = generateClient<Schema>();
      const saleWithSaleId = { ...saleItem, sale_id: sale.id! };
      return from(client.models.SaleItem.create(saleWithSaleId))
        .pipe(
          map((response: { data: unknown; }) => response.data as unknown as SaleItem),
          // tap((saleItem) => this._saleItems.push(saleItem))
        );
    };

    let cartItems = this.cartService.getCartItems();
    cartItems.forEach((cartItem) => {
      observables.push(writeSaleItem(cartItem.saleItem, sale.id!));
    });

    return combineLatest(observables)


  }

  getSaleItems(): Observable<SaleItem[]> {

    const _listSaleItems = (): Observable<SaleItem[]> => {
      const client = generateClient<Schema>();
      return from(client.models.SaleItem.list())
        .pipe(
          map((response: { data: unknown; }) => response.data as unknown as SaleItem[]),
          tap((saleItems) => {

            this._saleItems = saleItems;
          })
        );
    }
    return this._saleItems ? of(this._saleItems) : _listSaleItems();
  }

  writeOperation(sale: Sale): Observable<SaleItem[]> {
    console.log('saving sale', sale);
    const client = generateClient<Schema>();
    const { saleItems, ...saleInput } = sale;
    return from(client.models.Sale.create(saleInput))
      .pipe(
        map((response: { data: unknown; }) => {
          let new_sale = response.data as unknown as Sale;
          if (!new_sale || !new_sale.id) {
            throw new Error('sale writing not performed' + JSON.stringify(response));
          } else {
            sale.id = new_sale.id;
            // this._sales.push(sale);
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
          // selectionSet: ['id', 'amount', 'payer_id', 'season', 'event', 'vendor', 'sale_mode', 'bank', 'cheque_no', 'saleItems.*'],
          // filter: { session :  { eq: season } }
        })).pipe(
          map((response: { data: unknown; }) => response.data as unknown as Sale[]),
          tap((sales) => { this._sales = sales; })
        );
    }

    return (this._sales && !new_season) ? of(this._sales) : _listSales();
  }


}