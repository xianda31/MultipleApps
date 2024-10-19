import { computed, Injectable, Signal, signal } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { CartItem } from './cart.interface';
import { Revenue, Sale } from '../sales.interface';
import { remove } from 'aws-amplify/storage';

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private _cart: CartItem[] = [];
  private _cart$ = new BehaviorSubject<CartItem[]>(this._cart);

  private _revenues: Revenue[] = [];
  private _revenues$ = new BehaviorSubject<Revenue[]>(this._revenues);


  private _sales_of_the_day: Sale[] = [];
  private _sales_of_the_day$ = new BehaviorSubject<Sale[]>(this._sales_of_the_day);

  _complete_and_balanced = signal(false);

  get complete_and_balanced$(): Signal<boolean> {
    return (this._complete_and_balanced);
  }


  get revenues$(): Observable<Revenue[]> {
    return this._revenues$.asObservable();
  }


  addToRevenues(payment: Revenue): void {
    this._revenues.push(payment);
    this._revenues$.next(this._revenues);
    this._complete_and_balanced.update(() => this.isCompleteAndBalanced());
  }

  removeFromRevenues(payment: Revenue): void {
    const index = this._revenues.indexOf(payment);
    if (index > -1) {
      this._revenues.splice(index, 1);
      this._revenues$.next(this._revenues);
    }
    this._complete_and_balanced.update(() => this.isCompleteAndBalanced());
  }

  getRevenuesAmount(): number {
    return this._revenues.reduce((total, item) => total + item.amount, 0);
  }
  getRevenues(): Revenue[] {
    return this._revenues;
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
    this._revenues = [];
    this._cart$.next(this._cart);
    this._revenues$.next(this._revenues);
    this._complete_and_balanced.set(false);
  }


  getCartAmount(): number {
    return this._cart.reduce((total, item) => total + item.paied, 0);
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
    return (this._cart.every((item) => item.payee_id)) && (this.getCartAmount() === this.getRevenuesAmount());
  }


}
