import { Component, EventEmitter, OnDestroy, OnInit, Output } from '@angular/core';
import { CartService } from '../cart.service';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { Product } from '../../../../admin-dashboard/src/app/sales/products/product.interface';
import { Observable } from 'rxjs';
import { CartItem, PaymentMode } from './cart.interface';
import { ProductService } from '../../../../common/services/product.service';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { MembersService } from '../../../../admin-dashboard/src/app/members/service/members.service';
import { InputMemberComponent } from '../input-member/input-member.component';
import { Member } from '../../../../common/members/member.interface';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, FormsModule, InputMemberComponent, CurrencyPipe],
  templateUrl: './cart.component.html',
  styleUrl: './cart.component.scss'
})
export class CartComponent implements OnInit, OnDestroy {
  @Output() done = new EventEmitter<void>();
  // @Input() members: Member[] = [];
  cart_subscription: any;
  members_subscription: any;
  cart$ !: Observable<CartItem[]>;
  members!: Member[];
  products!: Product[];


  constructor(
    private membersService: MembersService,
    private cartService: CartService,
    private productService: ProductService,
    private modalService: NgbModal,

  ) { }
  ngOnDestroy(): void {
    // console.log('cart destroyed');
    this.cart_subscription.unsubscribe();
  }

  ngOnInit(): void {
    this.cart$ = this.cartService.getCart();
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

  get_member(member_id: string) {
    let payee = this.membersService.getMember(member_id);
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
    this.done.emit();
  }

  payee_changed(item: CartItem) {
    if (!item.payee) return;
    item.saleItem.payee_id = item.payee.id;
  }

  payee_cleared(item: CartItem) {
    item.payee = null;
  }

  some_payee_cleared(): boolean {
    return this.cartService.getCartItems().some((item) => !item.payee);
  }
}
