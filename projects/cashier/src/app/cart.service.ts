import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { CartItem, Payment } from './sales/sales/cart/cart.interface';

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private cart: CartItem[] = [];
  private cart$ = new BehaviorSubject<CartItem[]>(this.cart);
  private _payments_of_the_day: Payment[] = [];
  private _payments_of_the_day$ = new BehaviorSubject<Payment[]>(this._payments_of_the_day);



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

  push_saleItems_in_session(payment: Payment): void {
    const sale: Payment = { ...payment };
    sale.saleItems = [];
    this.cart.forEach((item) => { sale.saleItems!.push(item.saleItem) });
    this._payments_of_the_day.push(sale);
    this._payments_of_the_day$.next(this._payments_of_the_day);
  }


  get payments_of_the_day(): Observable<Payment[]> {
    return this._payments_of_the_day$.asObservable();
  }




}
