import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { DBhandler } from './graphQL.service';
import { StripeProduct, StripeProductInput } from '../../back/products/stripe-product.interface';

@Injectable({
  providedIn: 'root'
})
export class StripeProductService {
  constructor(private dbHandler: DBhandler) {}

  createStripeProduct(product: StripeProductInput): Promise<StripeProduct> {
    return this.dbHandler.createStripeProduct(product);
  }

  readStripeProduct(id: string): Promise<StripeProduct> {
    return this.dbHandler.readStripeProduct(id);
  }

  updateStripeProduct(product: StripeProductInput & { id: string }): Promise<StripeProduct> {
    return this.dbHandler.updateStripeProduct(product);
  }

  deleteStripeProduct(id: string): Promise<boolean> {
    return this.dbHandler.deleteStripeProduct(id);
  }

  listStripeProducts(): Observable<StripeProduct[]> {
    return this.dbHandler.listStripeProducts().pipe(
      map((products: StripeProduct[]) => products.filter((product) => product.active))
    );
  }
}