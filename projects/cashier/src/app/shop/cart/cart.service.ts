import { computed, Injectable, Signal, signal } from '@angular/core';
import { BehaviorSubject, map, Observable, of, tap } from 'rxjs';
import { CartItem } from './cart.interface';
import { Revenue, Sale, Session } from '../sales.interface';
import { remove } from 'aws-amplify/storage';
import { SalesService } from '../sales.service';
import { Member } from '../../../../../common/member.interface';

@Injectable({
  providedIn: 'root'
})

export class CartService {
  private _cart: CartItem[] = [];
  private _cart$ = new BehaviorSubject<CartItem[]>(this._cart);

  private _revenues: Revenue[] = [];
  private _revenues$ = new BehaviorSubject<Revenue[]>(this._revenues);

  private _sales_of_the_day: Sale[] = [];

  _complete_and_balanced = signal(false);

  constructor(
    private salesService: SalesService
  ) { }


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


  getRemainToPay(): number {
    return this.getCartAmount() - this.getRevenuesAmount();
  }

  getDebtRefundAmount(): number {
    return this._cart.filter((item) => item.product_id = 'debt').reduce((total, item) => total + item.paied, 0);
  }

  getCartItems(): CartItem[] {
    return this._cart;
  }

  private isCompleteAndBalanced(): boolean {
    return (this._cart.every((item) => item.payee_id)) && (this.getCartAmount() === this.getRevenuesAmount());
  }



  // sales of the day for logger

  // push_sale_of_the_day(sale: Sale): void {
  //   this._sales_of_the_day.push(sale);
  //   // this._sales_of_the_day$.next(this._sales_of_the_day);
  // }

  // get_sales_of_the_day(session: Session): Observable<Sale[]> {

  //   return this.salesService.getSales(session.season).pipe(
  //     map((sales) => sales.filter((sale) =>  sale.event === session.event)),
  //     tap((sales) => this._sales_of_the_day = sales),
  //   );
  // }

  //






}
