import { Injectable } from '@angular/core';
import { Payment, Sale } from '../cart/cart.interface';
import { generateClient } from 'aws-amplify/api';
import { Schema } from '../../../../../amplify/data/resource';
import { combineLatest, from, map, Observable, switchMap, tap } from 'rxjs';
import { CartService } from '../cart.service';

@Injectable({
  providedIn: 'root'
})
export class AccountingService {

  constructor(
    private cartService: CartService
  ) { }

  writeCart(payment_id: string): Observable<Sale[]> {

    let observables: Observable<Sale>[] = [];

    let writeSale: (sale: Sale, payment_id: string) => Observable<Sale> = (sale, payment_id) => {
      const client = generateClient<Schema>();
      const saleWithPaymentId = { ...sale, payment_id: payment_id };
      return from(client.models.Sale.create(saleWithPaymentId))
        .pipe(
          map((response: { data: unknown; }) => response.data as unknown as Sale),
          tap((sale) => console.log('sale', sale))
        );
    };

    let cartItems = this.cartService.getCartItems();
    cartItems.forEach((cartItem) => {
      observables.push(writeSale(cartItem.sale, payment_id));
    });

    return combineLatest(observables);
  }

  writeOperation(payment: Payment): Observable<boolean> {
    const client = generateClient<Schema>();
    return from(client.models.Payment.create(payment))
      .pipe(
        map((response: { data: unknown; }) => response.data as unknown as Payment),
        tap((payment) => console.log('payment', payment)),
        switchMap((payment) => {
          if (!payment.id) {
            throw new Error('Payment ID is undefined');
          }
          return this.writeCart(payment.id);
        }),
        map(() => true)
      );
  }

  getPayments(): Observable<Payment[]> {
    const client = generateClient<Schema>();
    return from(client.models.Payment.list(
      { selectionSet: ['id', 'amount', 'payment_mode', 'payer_id', 'season', 'sales.*'] }))
      .pipe(
        map((response: { data: unknown; }) => response.data as unknown as Payment[]),
        tap((operations) => console.log('operations', operations))
      );
  }

}