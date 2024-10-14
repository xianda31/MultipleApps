import { Injectable } from '@angular/core';
import { Payment, SaleItem } from './sales/cart/cart.interface';
import { generateClient } from 'aws-amplify/api';
import { Schema } from '../../../../../amplify/data/resource';
import { combineLatest, from, map, Observable, of, switchMap, tap } from 'rxjs';
import { CartService } from '../cart.service';

@Injectable({
  providedIn: 'root'
})
export class AccountingService {

  private _payments!: Payment[];
  private _saleItems!: SaleItem[];
  current_season: string = '';

  constructor(
    private cartService: CartService
  ) { }

  writeCart(payment_id: string): Observable<SaleItem[]> {
    let observables: Observable<SaleItem>[] = [];

    let writeSaleItem: (sale: SaleItem, payment_id: string) => Observable<SaleItem> = (sale, payment_id) => {

      const client = generateClient<Schema>();
      const saleWithPaymentId = { ...sale, payment_id: payment_id };
      return from(client.models.SaleItem.create(saleWithPaymentId))
        .pipe(
          map((response: { data: unknown; }) => response.data as unknown as SaleItem),
          // tap((saleItem) => this._saleItems.push(saleItem))
        );
    };

    let cartItems = this.cartService.getCartItems();
    cartItems.forEach((cartItem) => {
      observables.push(writeSaleItem(cartItem.saleItem, payment_id));
    });

    return combineLatest(observables).pipe(
      map((saleItems) => {
        return saleItems;
      })
    );
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

  writeOperation(payment: Payment): Observable<SaleItem[]> {
    const client = generateClient<Schema>();
    // const paymentWithStringEvent = { ...payment, event: payment.event.toISOString() };
    return from(client.models.Payment.create(payment))
      .pipe(
        switchMap((response: { data: unknown; }) => {
          let payment = response.data as unknown as Payment;
          if (!payment || !payment.id) {
            throw new Error('payment writing not performed' + JSON.stringify(response));
          } else {
            // this._payments.push(payment);
            return this.writeCart(payment.id);
          }
        })
      );
  }

  getPayment(payment_id: string): Payment | undefined {
    return this._payments.find((payment) => payment.id === payment_id);
  }

  getPayments(season: string): Observable<Payment[]> {
    let new_season = false;
    if (this.current_season !== season) {
      new_season = true;
      this.current_season = season;
    }

    const _listPayments = (): Observable<Payment[]> => {
      const client = generateClient<Schema>();
      return from(client.models.Payment.list(
        {
          // selectionSet: ['id', 'amount', 'payer_id', 'season', 'event', 'vendor', 'payment_mode', 'bank', 'cheque_no', 'saleItems.*'],
          filter: { season: { eq: season } }
        })).pipe(
          map((response: { data: unknown; }) => response.data as unknown as Payment[]),
          tap((payments) => { this._payments = payments; })
        );
    }

    return (this._payments && !new_season) ? of(this._payments) : _listPayments();
  }


}