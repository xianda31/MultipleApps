import { Component, EventEmitter, OnDestroy, OnInit, Output, Signal, signal } from '@angular/core';
import { CartService } from './cart.service';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { Product } from '../../../../../admin-dashboard/src/app/sales/products/product.interface';
import { map, Observable } from 'rxjs';
import { CartItem, Payment } from './cart.interface';
import { ProductService } from '../../../../../common/services/product.service';
import { MembersService } from '../../../../../admin-dashboard/src/app/members/service/members.service';
import { InputMemberComponent } from '../../input-member/input-member.component';
import { Member } from '../../../../../common/member.interface';
import { FormControl, FormGroup, FormsModule, Validators } from '@angular/forms';
import { PaymentMode } from '../sales.interface';
import { Bank } from '../../../../../common/system-conf.interface';
import { SystemDataService } from '../../../../../common/services/system-data.service';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, FormsModule, InputMemberComponent, CurrencyPipe],
  templateUrl: './cart.component.html',
  styleUrl: './cart.component.scss'
})
export class CartComponent implements OnInit, OnDestroy {
  // @Input() valid: boolean = false;
  @Output() complete = new EventEmitter<void>();

  sale_is_ok = signal(true);
  cart_subscription: any;
  members_subscription: any;

  // cart$ !: Observable<CartItem[]>;
  cart: CartItem[] = [];
  members!: Member[];
  products!: Product[];

  payments$ !: Observable<Payment[]>;
  paymentMode = PaymentMode;

  banks$ !: Observable<Bank[]>;

  complete_and_balanced$ !: Signal<boolean>;


  constructor(
    private membersService: MembersService,
    private cartService: CartService,
    private productService: ProductService,
    private systemDataService: SystemDataService,


  ) {

  }
  ngOnDestroy(): void {
    this.cart_subscription.unsubscribe();
    this.members_subscription.unsubscribe();
  }

  ngOnInit(): void {
    this.members_subscription = this.membersService.listMembers().subscribe((members) => {
      this.members = members;
    });
    this.cart_subscription = this.productService.listProducts().subscribe((products) => {
      this.products = products;
    });
    this.cartService.cart$.subscribe((cart) => {
      this.cart = cart;
    });
    this.banks$ = this.systemDataService.configuration$.pipe(map((conf) => conf.banks));

    this.payments$ = this.cartService.payments$;
    this.complete_and_balanced$ = this.cartService.complete_and_balanced$;

  }


  get_product_description(product_id: string): string {
    if (product_id === 'debt') return 'Dette';
    const product = this.products.find((product) => product.id === product_id);
    return product?.description || '???';
  }

  removeFromCart(cart_item: CartItem) {
    this.cartService.removeFromCart(cart_item);
  }

  some_payee_cleared(): boolean {
    return this.cartService.getCartItems().some((item) => !item.payee_id);
  }

  payeeChanged(index: number) {
    if (!this.cart[index].payee) return;
    this.cart[index].payee_id = this.cart[index].payee!.id;
  }

  getCartAmount() {
    return this.cartService.getCartAmount();
  }

  removeFromPayments(payment: Payment) {
    this.cartService.removeFromPayments(payment);
  }

  valid_sale() {
    this.complete.emit();
  }
}
