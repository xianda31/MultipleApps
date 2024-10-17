import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { CartItem, Sale } from './sales/sales/cart/cart.interface';

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private cart: CartItem[] = [];
  private cart$ = new BehaviorSubject<CartItem[]>(this.cart);
  private _sales_of_the_day: Sale[] = [];
  private sales_of_the_day$ = new BehaviorSubject<Sale[]>(this._sales_of_the_day);



  addToCart(CartItem: CartItem): void {
    this.cart.push(CartItem);
    this.cart$.next(this.cart);
  }

  removeFromCart(CartItem: CartItem): void {
    const index = this.cart.indexOf(CartItem);
    if (index > -1) {
      this.cart.splice(index, 1);
      this.cart$.next(this.cart);
    }
  }

  clearCart(): void {
    this.cart = [];
    this.cart$.next(this.cart);
  }

  getCart(): Observable<CartItem[]> {
    return this.cart$.asObservable();
  }

  getTotal(): number {
    return this.cart.reduce((total, item) => total + item.saleItem.price_payed, 0);
  }

  getQuantity(): number {
    return this.cart.length;
  }

  getCartItems(): CartItem[] {
    return this.cart;
  }

  push_saleItems_in_session(sale: Sale): void {
    // const _sale: Sale = { ...sale };
    // _sale.saleItems = [];
    // this.cart.forEach((item) => { _sale.saleItems!.push(item.saleItem) });
    this._sales_of_the_day.push(sale);
    this.sales_of_the_day$.next(this._sales_of_the_day);
  }


  get sales_of_the_day(): Observable<Sale[]> {
    return this.sales_of_the_day$.asObservable();
  }




}
