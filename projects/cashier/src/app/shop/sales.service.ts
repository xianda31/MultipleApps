import { Injectable } from '@angular/core';
import { generateClient } from 'aws-amplify/api';
import { Schema } from '../../../../../amplify/data/resource';
import { BehaviorSubject, catchError, combineLatest, from, map, Observable, of, switchMap, tap, throwError } from 'rxjs';
import { Sale, Session, Record } from './sales.interface';
import { CartItem, Payment } from './cart/cart.interface';
import { Member } from '../../../../common/member.interface';

@Injectable({
  providedIn: 'root'
})
export class SalesService {

  private _sales: Sale[] = [];
  private _sales$ = new BehaviorSubject<Sale[]>(this._sales);
  private _saleItems: CartItem[] = [];
  private _saleItems$ = new BehaviorSubject<CartItem[]>(this._saleItems);
  private _revenues: Payment[] = [];
  private _revenues$ = new BehaviorSubject<Payment[]>(this._revenues);
  current_season: string = '';

  constructor(
  ) { }


  // saleItems API

  // writeCartItems(saleItems: CartItem[], sale_id: string): Observable<CartItem[]> {
  //   let observables: Observable<CartItem>[] = [];

  //   let writeCartItem: (saleItem: CartItem, sale_id: string) => Observable<CartItem> = (saleItem, sale_id) => {
  //     const client = generateClient<Schema>();
  //     let { ...saleItemCreateInput } = { ...saleItem, sale_id };
  //     // console.log('saleItemCreateInput', saleItemCreateInput);
  //     return from(client.models.CartItem.create(saleItemCreateInput))
  //       .pipe(
  //         map((response: { data: unknown; }) => response.data as unknown as CartItem),
  //         tap((saleItem) => {
  //           this._saleItems.push(saleItem);
  //           this._saleItems$.next(this._saleItems);
  //         })
  //       );
  //   };

  //   saleItems.forEach((saleItem) => {
  //     observables.push(writeCartItem(saleItem, sale_id));
  //   });

  //   return combineLatest(observables)
  // }


  // getCartItems(season: string): Observable<CartItem[]> {
  //   let new_season = false;
  //   if (this.current_season !== season) {
  //     new_season = true;
  //     this.current_season = season;
  //   }

  //   const _listCartItems = (): Observable<CartItem[]> => {
  //     const client = generateClient<Schema>();
  //     return from(client.models.CartItem.list(
  //       {
  //         filter: { season: { eq: season } },
  //       }
  //     ))
  //       .pipe(
  //         map((response: { data: CartItem[] }) => response.data),
  //         tap((saleItems) => {
  //           this._saleItems = saleItems;
  //           this._saleItems$.next(this._saleItems);
  //         })
  //       );
  //   }
  //   return (this._saleItems.length > 0 && !new_season) ? (this._saleItems$.asObservable()) : _listCartItems();
  // }


  // Revenues API



  // getRevenues(season: string): Observable<Payment[]> {

  //   let new_season = false;
  //   if (this.current_season !== season) {
  //     new_season = true;
  //     this.current_season = season;
  //   }
  //   const _listRevenues = (): Observable<Payment[]> => {
  //     const client = generateClient<Schema>();
  //     return from(client.models.Payment.list(
  //       {
  //         filter: { season: { eq: season } },
  //       }
  //     ))
  //       .pipe(
  //         map((response: { data: any }) => response.data as unknown as Payment[]),
  //         tap((revenues) => {
  //           this._revenues = revenues;
  //         })
  //       );
  //   }
  //   return (this._revenues.length > 0 && !new_season) ? of(this._revenues) : _listRevenues();
  // }

  // writeRevenues(revenues: Payment[], sale_id: string): Observable<Payment[]> {
  //   let observables: Observable<Payment>[] = [];

  //   let writeRevenue: (revenue: Payment) => Observable<Payment> = (revenue) => {
  //     let { ...revenueCreateInput } = { ...revenue, sale_id };
  //     const client = generateClient<Schema>();
  //     return from(client.models.Payment.create(revenueCreateInput))
  //       .pipe(
  //         map((response: { data: unknown }) => response.data as unknown as Payment),
  //       );
  //   };

  //   revenues.forEach((revenue) => {
  //     observables.push(writeRevenue(revenue));
  //   });

  //   return combineLatest(observables)
  // }

  // // sale API

  // writeOperation(sale: Sale): Observable<[CartItem[], Payment[]]> {

  //   const client = generateClient<Schema>();
  //   const { saleItems, ...saleInput } = sale;
  //   // console.log('saleInput', saleInput);
  //   return from(client.models.Sale.create(saleInput))
  //     .pipe(
  //       map((response: { data: unknown; }) => {
  //         let new_sale = response.data as unknown as Sale;
  //         if (!new_sale || !new_sale.id) {
  //           throw new Error('sale writing not performed' + JSON.stringify(response));
  //         } else {
  //           sale.id = new_sale.id;
  //           if (this._sales) this._sales.push(sale);
  //           this._sales$.next(this._sales);
  //           return sale;
  //         }
  //       }),
  //       switchMap((sale) => {
  //         return combineLatest([
  //           this.writeCartItems(sale.saleItems, sale.id!),
  //           this.writeRevenues(sale.revenues, sale.id!)
  //         ]);
  //       })

  //     );
  // }


  // Record API

  cart2Record(session: Session, sale_id: string, cart: CartItem): Record {
    return {
      class: 'Product_credit',
      season: session.season,
      amount: cart.paied,
      // debit_credit: DebitCredit.CREDIT,
      sale_id: sale_id,

      product_id: cart.product_id,
      member_id: cart.payee_id,
    }
  }

  payment2Record(session: Session, sale_id: string, payment: Payment): Record {
    return {
      class: 'Payment_debit',
      season: session.season,
      amount: payment.amount,
      // debit_credit: DebitCredit.DEBIT,
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

  get_records(season: string): Observable<Record[]> {

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

  create_sale$(session: Session, payer: Member, amount: number): Observable<Sale> {
    const client = generateClient<Schema>();
    return from(client.models.Sale.create({
      // amount: amount,
      season: session.season,
      // vendor: session.vendor,
      event: session.event,
      payer_id: payer.id,
    })
      .then((response) => {
        const created_sale = response.data as unknown as Sale;
        // console.log('created sale', created_sale);
        return created_sale;
      })
      .catch((error) => {
        console.error('error', error);
        throw new Error(error)
      }));
  }

  save_sale$(session: Session, buyer: Member, cart: CartItem[], payments: Payment[]): Observable<Sale> {
    console.log('save_sale', cart, payments);
    let new_sale: Sale;
    return this.create_sale$(session, buyer, cart.reduce((total, item) => total + item.paied, 0))
      .pipe(
        catchError((error) => {
          console.error('error', error);
          throw new error(error);
        }),
        map((sale) => {
          new_sale = sale;
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

  get_sales(season: string): Observable<Sale[]> {
    let new_season = false;
    if (this.current_season !== season) {
      new_season = true;
      this.current_season = season;
    }

    const _listSales = (): Observable<Sale[]> => {
      const client = generateClient<Schema>();
      return from(client.models.Sale.list(
        {
          selectionSet: ['id', 'season', 'event', 'payer_id', 'records.*'],
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


}