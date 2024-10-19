import { computed, Injectable, Signal, signal } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { CartItem } from './cart/cart.interface';
import { Payment, Sale } from './sales/sales/sales.interface';
import { remove } from 'aws-amplify/storage';

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private _cart: CartItem[] = [];
  private _cart$ = new BehaviorSubject<CartItem[]>(this._cart);

  private _payments: Payment[] = [];
  private _payments$ = new BehaviorSubject<Payment[]>(this._payments);


  private _sales_of_the_day: Sale[] = [];
  private _sales_of_the_day$ = new BehaviorSubject<Sale[]>(this._sales_of_the_day);

  _complete_and_balanced = signal(false);

  get complete_and_balanced$(): Signal<boolean> {
    return (this._complete_and_balanced);
  }


  get payments$(): Observable<Payment[]> {
    return this._payments$.asObservable();
  }


  addToPayments(payment: Payment): void {
    this._payments.push(payment);
    this._payments$.next(this._payments);
    this._complete_and_balanced.update(() => this.isCompleteAndBalanced());
  }

  removeFromPayments(payment: Payment): void {
    const index = this._payments.indexOf(payment);
    if (index > -1) {
      this._payments.splice(index, 1);
      this._payments$.next(this._payments);
    }
    this._complete_and_balanced.update(() => this.isCompleteAndBalanced());
  }

  getPaymentsAmount(): number {
    return this._payments.reduce((total, item) => total + item.amount, 0);
  }
  getPayments(): Payment[] {
    return this._payments;
  }


  get cart$(): Observable<CartItem[]> {
    return this._cart$.asObservable();
  }

  addToCart(CartItem: CartItem): void {
    this._cart.push(CartItem);
    this._cart$.next(this._cart);
    this._complete_and_balanced.update(() => this.isCompleteAndBalanced());
  }

  removeFromCart(CartItem: CartItem): void {
    const index = this._cart.indexOf(CartItem);
    if (index > -1) {
      this._cart.splice(index, 1);
      this._cart$.next(this._cart);
      this._complete_and_balanced.update(() => this.isCompleteAndBalanced());
    }
  }

  clearCart(): void {
    this._cart = [];
    this._payments = [];
    this._cart$.next(this._cart);
    this._payments$.next(this._payments);
    this._complete_and_balanced.set(false);
  }


  getCartAmount(): number {
    return this._cart.reduce((total, item) => total + item.payed, 0);
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


  private isCompleteAndBalanced(): boolean {
    return (this._cart.every((item) => item.payee_id)) && (this.getCartAmount() === this.getPaymentsAmount());
  }


}
