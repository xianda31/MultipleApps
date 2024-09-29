import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { CartItem } from './cart/cart.interface';

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private cart: CartItem[] = [];
  private cart$ = new BehaviorSubject<CartItem[]>(this.cart);

  constructor() { }

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
    return this.cart.reduce((total, item) => total + item.sale.price_payed, 0);
  }

  getQuantity(): number {
    return this.cart.length;
  }

  getCartItems(): CartItem[] {
    return this.cart;
  }
}
