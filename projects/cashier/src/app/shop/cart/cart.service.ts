import { Injectable, Signal, signal } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { CartItem, Payment } from './cart.interface';
import { Sale, Session } from '../sales.interface';
import { SalesService } from '../sales.service';
import { Member } from '../../../../../common/member.interface';

@Injectable({
  providedIn: 'root'
})

export class CartService {
  private _cart: CartItem[] = [];
  private _cart$ = new BehaviorSubject<CartItem[]>(this._cart);

  private _payments: Payment[] = [];
  private _payments$ = new BehaviorSubject<Payment[]>(this._payments);

  private _sales_of_the_day: Sale[] = [];

  _complete_and_balanced = signal(false);

  constructor(
    private salesService: SalesService
  ) { }


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
    return this._cart.reduce((total, item) => total + item.paied, 0);
  }


  getRemainToPay(): number {
    return this.getCartAmount() - this.getPaymentsAmount();
  }

  getCreditAmount(): number {
    const debt = this._cart.filter((item) => item.product_id = 'debt').reduce((total, item) => total + item.paied, 0);
    if (debt !== 0) {
      console.log('debt in', this._cart.filter((item) => item.product_id = 'debt'));
    }
    console.log('debt', debt);
    return debt;
  }

  getCartItems(): CartItem[] {
    return this._cart;
  }

  private isCompleteAndBalanced(): boolean {
    return (this._cart.every((item) => item.payee_id)) && (this.getCartAmount() === this.getPaymentsAmount());
  }


  save_sale(session: Session, buyer: Member): void {
    this.salesService.save_sale$(session, buyer, this._cart, this._payments)
      .subscribe((sale) => {
        // console.log('sale saved', sale);
        this._sales_of_the_day.push(sale);
        this.clearCart();
      });
  }





}
