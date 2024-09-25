import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { CartService } from '../cart.service';
import { Form, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { Product } from '../../../../admin-dashboard/src/app/sales/products/product.interface';
import { Observable } from 'rxjs';
import { Member } from '../../../../common/members/member.interface';
import { CartItem } from './cart.interface';
import { ProductService } from '../../../../common/services/product.service';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, CurrencyPipe],
  templateUrl: './cart.component.html',
  styleUrl: './cart.component.scss'
})
export class CartComponent implements OnInit, OnDestroy {
  @Input() members: Member[] = [];
  cart_subscription: any;
  cart$ !: Observable<CartItem[]>;
  products!: Product[];

  constructor(
    private cartService: CartService,
    private productService: ProductService
  ) { }
  ngOnDestroy(): void {
    // this.cart_subscription.unsubscribe();
  }

  ngOnInit(): void {
    this.cart$ = this.cartService.getCart();
    this.productService.listProducts().subscribe((products) => {
      this.products = products;
    });
  }

  get_product(product_id: string) {
    return this.products.find((product) => product.id === product_id);
  }

  get_member(member_id: string) {
    if (!this.members) console.log('members not found');
    let payee = this.members.find((member) => member.id === member_id);
    if (!payee) { console.log('payee not found', member_id); }
    return payee;
  }

  removeFromCart(cart_item: CartItem) {
    this.cartService.removeFromCart(cart_item);
  }

  getTotal() {
    return this.cartService.getTotal();
  }

  checkout() {
    // Implement checkout logic here
  }
}
