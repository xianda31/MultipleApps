import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { CartService } from '../cart.service';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { Product } from '../../../../admin-dashboard/src/app/sales/products/product.interface';
import { Observable } from 'rxjs';
import { CartItem } from './cart.interface';
import { ProductService } from '../../../../common/services/product.service';
import { MembersService } from '../../../../admin-dashboard/src/app/members/service/members.service';
import { InputMemberComponent } from '../input-member/input-member.component';
import { Member } from '../../../../common/member.interface';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, FormsModule, InputMemberComponent, CurrencyPipe],
  templateUrl: './cart.component.html',
  styleUrl: './cart.component.scss'
})
export class CartComponent implements OnInit, OnDestroy {
  @Input() valid: boolean = false;
  @Output() validChange = new EventEmitter<boolean>();

  cart_subscription: any;
  members_subscription: any;

  cart$ !: Observable<CartItem[]>;
  members!: Member[];
  products!: Product[];

  constructor(
    private membersService: MembersService,
    private cartService: CartService,
    private productService: ProductService,

  ) { }
  ngOnDestroy(): void {
    this.cart_subscription.unsubscribe();
    this.members_subscription.unsubscribe();
  }

  ngOnInit(): void {
    this.cart$ = this.cartService.cart$;
    this.cart_subscription = this.productService.listProducts().subscribe((products) => {
      this.products = products;
    });
    this.members_subscription = this.membersService.listMembers().subscribe((members) => {
      this.members = members;
    });

  }

  get_product(product_id: string) {
    return this.products.find((product) => product.id === product_id);
  }

  removeFromCart(cart_item: CartItem) {
    this.cartService.removeFromCart(cart_item);
  }

  payee_changed(item: CartItem) {
    if (!item.payee) return;
    item.payee_id = item.payee.id;
    this.validChange.emit(true);
  }

  payee_cleared(item: CartItem) {
    item.payee = null;
    this.validChange.emit(false);
  }

  some_payee_cleared(): boolean {
    return this.cartService.getCartItems().some((item) => !item.payee_id);
  }
}
