import { Injectable } from '@angular/core';
import { generateClient } from 'aws-amplify/api';
import { Schema } from '../../../../../amplify/data/resource';
import { BehaviorSubject, catchError, combineLatest, from, map, Observable, of, switchMap, tap } from 'rxjs';
import { Sale, Session, Record, PaymentMode } from './sales.interface';
import { CartItem, Payment } from './cart/cart.interface';
import { Member } from '../../../../common/member.interface';
import { ProductService } from '../../../../common/services/product.service';
import { Product } from '../../../../admin-dashboard/src/app/sales/products/product.interface';
import { ToastService } from '../../../../common/toaster/toast.service';

@Injectable({
  providedIn: 'root'
})
export class SalesService {

  private _sales!: Sale[];
  private _sales$ = new BehaviorSubject<Sale[]>(this._sales);
  current_season: string = '';
  products: Product[] = [];

  constructor(
    private productService: ProductService,
    private toastservice: ToastService

  ) {
    this.productService.listProducts().subscribe((products) => {
      this.products = products;
    });

  }

  // sale CRUD(L) API

  // Sale only (without records)  API

  create_sale$(sale: Sale): Observable<Sale> {

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

  read_sale(sale_id: string): Sale | undefined {
    return this._sales.find((sale) => sale.id === sale_id);
  }

  delete_sale$(sale_id: string): Observable<Sale> {
    const client = generateClient<Schema>();
    return from(client.models.Sale.delete({ id: sale_id })
      .then((response) => {
        if (response.errors) {
          console.error('error', response.errors);
          throw new Error(JSON.stringify(response.errors));
        } else return response.data as unknown as Sale;

      })
      .catch((error) => {
        console.error('error', error);
        throw new Error(error);
      }));
  }

  // Sale with records API

  f_create_sale$(sale: Sale): Observable<Sale> {
    if (!sale.records) throw new Error('no records in sale');
    let records: Record[] = sale.records;
    return this.create_sale$(sale).pipe(
      switchMap((sale) =>
        combineLatest(records.map((record) => {
          record.sale_id = sale.id!;
          return this.create_record$(record);
        })).pipe(
          map((records) => {
            sale.records = records;
            this._sales.push(sale);
            this._sales$.next(this._sales);
            return sale;
          }),

        )
      )
    );
  }
  f_delete_sale$(sale_id: string): Observable<boolean> {
    const sale = this._sales.find((sale) => sale.id === sale_id);
    if (!sale) {
      throw new Error('sale not found');
    }
    const records = sale.records;
    if (!records) {
      throw new Error('no records in sale');
    }


    return combineLatest(records.map((record) => this.delete_record$(record.id!))).pipe(
      // map(() => console.log('records deleted')),
      switchMap(() => this.delete_sale$(sale_id)),
      catchError((error) => {
        this.toastservice.showWarningToast('erreur', 'vente non correctement supprimée');
        console.error('error', error);
        throw new Error(error);
      }),
      map(() => {
        // console.log('sale deleted', sale_id);
        return true
      })
    );

  }




  f_list_sales$(season: string): Observable<Sale[]> {
    let new_season = false;
    if (this.current_season !== season) {
      new_season = true;
      this.current_season = season;
    }

    const _listSales = (): Observable<Sale[]> => {
      console.log('fetching sales from ', this._sales ? 'cache' : 'AWS');

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
          }),
          switchMap(() => this._sales$.asObservable())
        );
    }
    return (this._sales && !new_season) ? this._sales$.asObservable() : _listSales();
  }


  // Record API



  create_record$(record: Record): Observable<Record> {
    const client = generateClient<Schema>();
    const recordInput = { ...record };
    return from(client.models.Record.create(recordInput)
      .then((response) => {
        // console.log('response', response);
        if (response.errors) {
          console.error('record creation error ', response.errors);
          console.error('recordInput', recordInput);
          throw new Error(JSON.stringify(response.errors));
        }
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
        // console.log('response', response);
        return response.data as unknown as Record;
      })
      .catch((error) => {
        console.error('error', error);
        throw new Error(error);
      }));
  }


}