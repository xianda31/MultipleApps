import { Injectable } from '@angular/core';
import { BehaviorSubject, from, Observable, of, tap } from 'rxjs';
import { CartItem, Payment } from './cart/cart.interface';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { GetEventComponent } from './get-event/get-event.component';

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private cart: CartItem[] = [];
  private cart$ = new BehaviorSubject<CartItem[]>(this.cart);
  private _current_session: Date | null = null;

  private _payments: Payment[] = [];
  private _payments$ = new BehaviorSubject<Payment[]>(this._payments);

  constructor(
    private modalService: NgbModal,

  ) { }

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

  open_sale_session(): Observable<Date | null> {
    const set_event = (): Observable<Date | null> => {
      console.log('set_event');
      const modalRef = this.modalService.open(GetEventComponent, { centered: true });
      return from(modalRef.result).pipe(
        tap((date: Date | null) => {
          this._current_session = date;
        }),
      );
    }
    return (this._current_session !== null) ? of(this._current_session) : set_event();
  }

  push_sale_in_session(payment: Payment): void {
    const sale: Payment = { ...payment };
    sale.saleItems = [];
    this.cart.forEach((item) => { sale.saleItems!.push(item.saleItem) });
    this._payments.push(sale);
    this._payments$.next(this._payments);
  }

  get_sales_in_session(): Observable<Payment[]> {
    return this._payments$.asObservable();
  }

  close_sale_session() {
    console.log('close_sale_session');
    this._current_session = null;
  }

}
