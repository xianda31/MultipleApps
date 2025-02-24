import { Component, EventEmitter, Output, signal } from '@angular/core';
import { CartService } from './cart.service';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { Product } from '../../../../../admin-dashboard/src/app/sales/products/product.interface';
import { map, Observable } from 'rxjs';
import { Cart, CartItem, Payment, PaymentMode } from './cart.interface';
import { ProductService } from '../../../../../common/services/product.service';
import { MembersService } from '../../../../../admin-dashboard/src/app/members/service/members.service';
import { InputMemberComponent } from '../../input-member/input-member.component';
import { Member } from '../../../../../common/member.interface';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Bank } from '../../../../../common/system-conf.interface';
import { SystemDataService } from '../../../../../common/services/system-data.service';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, InputMemberComponent, CurrencyPipe],
  templateUrl: './cart.component.html',
  styleUrl: './cart.component.scss'
})
export class CartComponent {
  @Output() complete = new EventEmitter<void>();

  debt_amount = 0;
  asset_amount = 0;
  total_amount = signal(0);

  cart: Cart = { items: [], debt: null, asset: null, buyer_name: '' };
  members!: Member[];
  products!: Product[];

  paymentMode = PaymentMode;
  selected_payment !: Payment;

  banks$ !: Observable<Bank[]>;

  constructor(
    private membersService: MembersService,
    private cartService: CartService,
    private productService: ProductService,
    private systemDataService: SystemDataService,

  ) { }


  ngOnInit(): void {

    this.clear_payment();

    this.membersService.listMembers().subscribe((members) => {
      this.members = members;
    });
    this.productService.listProducts().subscribe((products) => {
      this.products = products;
    });
    this.banks$ = this.systemDataService.get_configuration().pipe(map((conf) => conf.banks));



    this.cartService.cart$.subscribe((cart) => {
      this.cart = cart;
      this.debt_amount = cart.debt?.amount || 0;
      this.asset_amount = cart.asset?.amount || 0;

      if (this.cart.items.length === 0) {
        this.clear_payment();
      }
      this.total_amount.update(() => this.cartService.getCartAmount());

    });
  }

  get_product_description(product_id: string): string {
    const product = this.products.find((product) => product.id === product_id);
    return product?.description || '???';
  }

  removeFromCart(cart_item: CartItem) {
    this.cartService.removeFromCart(cart_item);
  }

  some_payee_cleared(): boolean {
    return this.cartService.getCartItems().some((item) => !item.payee_name);
  }

  payeeChanged(index: number) {
    if (!this.cart.items[index].payee) return;
    this.cart.items[index].payee_name = this.cart.items[index].payee!.lastname + ' ' + this.cart.items[index].payee!.firstname;
  }

  clear_payment() {
    this.selected_payment = {
      amount: 0,
      payer_id: '',
      mode: '' as unknown as PaymentMode,
      bank: '',
      cheque_no: ''
    }
  }

  getCartAmount() {
    return this.cartService.getCartAmount();
  }

  payment_mode_change() {
    this.cartService.payment = this.selected_payment;
  }

  validate_sale() {
    this.complete.emit();
    this.clear_payment();
    this.debt_amount = 0;
    this.asset_amount = 0;

  }
}
