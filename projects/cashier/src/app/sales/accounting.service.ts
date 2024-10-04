import { Injectable } from '@angular/core';
import { Payment, SaleItem } from '../cart/cart.interface';
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
        map((response: { data: unknown; }) => {
          let payment = response.data as unknown as Payment;
          if (!payment || !payment.id) {
            throw new Error('payment writing not performed');
          } else {
            // this._payments.push(payment);
            return this.writeCart(payment.id);
          }
        }),
        switchMap((saleItems) => saleItems)
        // map(() => true)
      );
  }

  getPayment(payment_id: string): Payment | undefined {
    return this._payments.find((payment) => payment.id === payment_id);
  }

  getPayments(): Observable<Payment[]> {

    const _listPayments = (): Observable<Payment[]> => {
      const client = generateClient<Schema>();
      return from(client.models.Payment.list(
        { selectionSet: ['id', 'amount', 'payer_id', 'payment_mode', 'bank', 'cheque_no', 'saleItems.*'] }))
        .pipe(
          map((response: { data: unknown; }) => response.data as unknown as Payment[]),
          tap((payments) => {
            this._payments = payments;
            console.log('payments', payments);
          })
        );
    }

    return this._payments ? of(this._payments) : _listPayments();
  }


}