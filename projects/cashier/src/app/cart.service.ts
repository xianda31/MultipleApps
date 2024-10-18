import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { CartItem, Sale } from './cart/cart.interface';

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private _cart: CartItem[] = [];
  private _cart$ = new BehaviorSubject<CartItem[]>(this._cart);

  private _sales_of_the_day: Sale[] = [];
  private _sales_of_the_day$ = new BehaviorSubject<Sale[]>(this._sales_of_the_day);


  get cart$(): Observable<CartItem[]> {
    return this._cart$.asObservable();
  }

  addToCart(CartItem: CartItem): void {
    this._cart.push(CartItem);
    this._cart$.next(this._cart);
  }

  removeFromCart(CartItem: CartItem): void {
    const index = this._cart.indexOf(CartItem);
    if (index > -1) {
      this._cart.splice(index, 1);
      this._cart$.next(this._cart);
    }
  }

  clearCart(): void {
    this._cart = [];
    this._cart$.next(this._cart);
  }


  getCartAmount(): number {
    return this._cart.reduce((total, item) => total + item.saleItem.price_payed, 0);
  }


  getCartItems(): CartItem[] {
    return this._cart;
  }


  // sales of the day for logger

  push_sale_of_the_day(sale: Sale): void {
    this._sales_of_the_day.push(sale);
    this._sales_of_the_day$.next(this._sales_of_the_day);
  }

  get sales_of_the_day$(): Observable<Sale[]> {
    return this._sales_of_the_day$.asObservable();
  }

  reset_sales_of_the_day(): void {
    this._sales_of_the_day = [];
    this._sales_of_the_day$.next(this._sales_of_the_day);
  }




}
