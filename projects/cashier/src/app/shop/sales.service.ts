import { Injectable } from '@angular/core';
import { generateClient } from 'aws-amplify/api';
import { Schema } from '../../../../../amplify/data/resource';
import { BehaviorSubject, catchError, combineLatest, from, map, Observable, of, switchMap, tap } from 'rxjs';
import { Sale, Session, Record, PaymentMode } from './sales.interface';
import { CartItem, Payment } from './cart/cart.interface';
import { Member } from '../../../../common/member.interface';
import { ProductService } from '../../../../common/services/product.service';
import { Product } from '../../../../admin-dashboard/src/app/sales/products/product.interface';

@Injectable({
  providedIn: 'root'
})
export class SalesService {

  private _sales: Sale[] = [];
  private _sales$ = new BehaviorSubject<Sale[]>(this._sales);
  current_season: string = '';
  products: Product[] = [];

  constructor(
    private productService: ProductService

  ) {
    this.productService.listProducts().subscribe((products) => {
      this.products = products;
    });

  }


  // Record API

  cart2Record(session: Session, sale_id: string, cart: CartItem): Record {
    if (cart.product_id === 'debt') {
      return {
        class: 'Payment_debit',
        season: session.season,
        amount: -cart.paied,
        sale_id: sale_id,

        member_id: cart.payee_id,
        mode: PaymentMode.CREDIT
      }
    } else {
      return {
        class: 'Product_credit',
        season: session.season,
        amount: cart.paied,
        sale_id: sale_id,

        product_id: cart.product_id,
        member_id: cart.payee_id,
      }
    }
  }

  payment2Record(session: Session, sale_id: string, payment: Payment): Record {
    return {
      class: 'Payment_debit',
      season: session.season,
      amount: payment.amount,
      sale_id: sale_id,

      member_id: payment.payer_id,
      mode: payment.mode,
      bank: payment.bank,
      cheque_no: payment.cheque_no,
    }
  }

  create_record$(record: Record): Observable<Record> {
    const client = generateClient<Schema>();
    const recordInput = { ...record };
    return from(client.models.Record.create(recordInput)
      .then((response) => {
        return response.data as unknown as Record;
      })
      .catch((error) => {
        console.error('error', error);
        throw new Error(error);
      })
    );
  }

  read_records$(season: string): Observable<Record[]> {

    const client = generateClient<Schema>();
    return from(client.models.Record.list(
      {
        filter: { season: { eq: season } },
      }
    ))
      .pipe(
        map((response: { data: any }) => response.data as unknown as Record[]),
      );
  }

  delete_record$(record_id: string): Observable<Record> {
    const client = generateClient<Schema>();
    return from(client.models.Record.delete({ id: record_id })
      .then((response) => {
        return response.data as unknown as Record;
      })
      .catch((error) => {
        console.error('error', error);
        throw new Error(error);
      }));
  }

  create_sale$(sale: Sale): Observable<Sale> {
    // console.log('sale to create', sale);
    const client = generateClient<Schema>();
    return from(client.models.Sale.create(sale)
      .then((response) => {
        // console.log('response', response);
        const created_sale = response.data as unknown as Sale;    // marche pas si error dans response
        // console.log('created sale', created_sale);
        return created_sale;
      })
      .catch((error) => {             // non capté si error dans response !!!!
        console.error('error', error);
        throw new Error(error)
      }));
  }


  delete_sale$(sale_id: string): Observable<Sale> {
    const client = generateClient<Schema>();
    return from(client.models.Sale.delete({ id: sale_id })
      .then((response) => {
        return response.data as unknown as Sale;
      })
      .catch((error) => {
        console.error('error', error);
        throw new Error(error);
      }));
  }

  cancel_sale$(sale_id: string): Observable<boolean> {
    const sale = this._sales.find((sale) => sale.id === sale_id);
    if (!sale) { return of(false); }
    const records = sale.records;
    if (!records) { return of(false) }
    return combineLatest(records.map((record) => this.delete_record$(record.id!))).pipe(
      switchMap(() => this.delete_sale$(sale_id)),
      catchError((error) => {
        console.error('error', error);
        throw new Error(error);
      }),
      map(() => true)
    );

  }

  save_sale$(session: Session, buyer: Member, cart: CartItem[], payments: Payment[]): Observable<Sale> {
    // console.log('save_sale', session);
    let new_sale: Sale;
    return this.create_sale$({ ...session, payer_id: buyer.id! })
      .pipe(
        catchError((error) => {
          console.error('error', error);
          throw new error(error);
        }),
        map((sale) => {
          new_sale = sale;
          console.log('new_sale', new_sale);
          return sale;
        }),
        switchMap((sale) => {
          const records: Record[] = [];
          cart.forEach((cartItem) => {
            records.push(this.cart2Record(session, sale.id!, cartItem));
          });
          payments.forEach((payment) => {
            records.push(this.payment2Record(session, sale.id!, payment));
          });
          return combineLatest(records.map((record) => this.create_record$(record)));
        }),
        catchError((error) => {
          console.error('error', error);
          throw new Error(error);
        }),
        switchMap((records) => {
          new_sale.records = records;
          this._sales.push(new_sale);
          this._sales$.next(this._sales);
          return of(new_sale);
        })
      )
  }

  get_sale(sale_id: string): Sale | undefined {
    return this._sales.find((sale) => sale.id === sale_id);
  }


  get_sales$(season: string): Observable<Sale[]> {
    let new_season = false;
    if (this.current_season !== season) {
      new_season = true;
      this.current_season = season;
    }

    const _listSales = (): Observable<Sale[]> => {
      const client = generateClient<Schema>();
      return from(client.models.Sale.list(
        {
          selectionSet: ['id', 'season', 'event', 'vendor', 'payer_id', 'records.*'],
          filter: { season: { eq: season } },
        })).pipe(
          map((response: { data: unknown; }) => response.data as unknown as Sale[]),
          tap((sales) => {
            this._sales = sales;
            this._sales$.next(this._sales);
          })
        );
    }
    return (this._sales && !new_season) ? this._sales$.asObservable() : _listSales();
  }

  // utility functions


}