import { Component, EventEmitter, OnDestroy, OnInit, Output } from '@angular/core';
import { CartService } from '../cart.service';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { Product } from '../../../../admin-dashboard/src/app/sales/products/product.interface';
import { Observable } from 'rxjs';
import { CartItem, PaymentMode } from './cart.interface';
import { ProductService } from '../../../../common/services/product.service';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { MembersService } from '../../../../admin-dashboard/src/app/members/service/members.service';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, CurrencyPipe],
  templateUrl: './cart.component.html',
  styleUrl: './cart.component.scss'
})
export class CartComponent implements OnInit, OnDestroy {
  @Output() done = new EventEmitter<void>();
  // @Input() members: Member[] = [];
  cart_subscription: any;
  cart$ !: Observable<CartItem[]>;
  products!: Product[];


  constructor(
    private membersService: MembersService,
    private cartService: CartService,
    private productService: ProductService,
    private modalService: NgbModal,

  ) { }
  ngOnDestroy(): void {
    console.log('cart destroyed');
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
  // checkout() {
  //   const modalRef = this.modalService.open(GetPaymentComponent, { centered: true });

  //   let payment_in: Payment = {
  //     season: '2024/25',
  //     amount: this.getTotal() + 1000,
  //     payer_id: 'XXXX',
  //     payment_mode: PaymentMode.CASH,
  //   }


  //   modalRef.componentInstance.payment_in = payment_in;

  //   modalRef.result.then((payment: string) => {
  //     if (payment === null) return;
  //     console.log('payment', payment);
  //   });
  // }
}
