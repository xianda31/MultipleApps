import { Component, EventEmitter, Input, Output, signal, SimpleChanges } from '@angular/core';
import { CartService } from './cart.service';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { Product } from '../../../../../admin-dashboard/src/app/sales/products/product.interface';
import { combineLatest, map, Observable } from 'rxjs';
import { CartItem, Payment, PaymentMode } from './cart.interface';
import { ProductService } from '../../../../../common/services/product.service';
import { MembersService } from '../../../../../admin-dashboard/src/app/members/service/members.service';
import { InputMemberComponent } from '../../input-member/input-member.component';
import { Member } from '../../../../../common/member.interface';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
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
  @Input() debt_amount = 0;
  @Input() asset_amount = 0;

  total_amount = signal(0);
  // sale_is_ok = signal(false);

  cart: CartItem[] = [];
  members!: Member[];
  products!: Product[];

  // payments !: Payment[];
  paymentMode = PaymentMode;
  // payment_form !: FormGroup;
  // selected_payment.mode!: PaymentMode;
  selected_payment !: Payment;

  banks$ !: Observable<Bank[]>;

  constructor(
    private membersService: MembersService,
    private cartService: CartService,
    private productService: ProductService,
    private systemDataService: SystemDataService,


  ) { }

  ngOnChanges(changes: SimpleChanges): void {


    if (changes['debt_amount'] && changes['debt_amount'].currentValue > 0) {
      this.cartService.setDebt(changes['debt_amount'].currentValue);
      this.total_amount.update(() => this.cartService.getCartAmount());
    }
    if (changes['asset_amount'] && changes['asset_amount'].currentValue > 0) {
      this.cartService.setAsset(changes['asset_amount'].currentValue);
      this.total_amount.update(() => this.cartService.getCartAmount());
    }
  }


  ngOnInit(): void {

    this.clear_payment();

    this.membersService.listMembers().subscribe((members) => {
      this.members = members;
    });
    this.productService.listProducts().subscribe((products) => {
      this.products = products;
    });
    this.banks$ = this.systemDataService.configuration$.pipe(map((conf) => conf.banks));



    this.cartService.cart$.subscribe((cart) => {
      this.cart = cart;
      if (this.cart.length === 0) {
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
    return this.cartService.getCartItems().some((item) => !item.payee_id);
  }

  payeeChanged(index: number) {
    if (!this.cart[index].payee) return;
    this.cart[index].payee_id = this.cart[index].payee!.id;
    this.cart[index].payee_name = this.cart[index].payee!.lastname + ' ' + this.cart[index].payee!.firstname;
    // console.log('payeeChanged', this.cart[index].payee_name);
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
    console.log('payment_mode_change', this.selected_payment);
    this.cartService.payment = this.selected_payment;
  }

  // removeFromPayments(payment: Payment) {
  //   // this.cartService.removeFromPayments(payment);
  // }

  validate_sale() {
    this.complete.emit();
    this.clear_payment();
    this.debt_amount = 0;
    this.asset_amount = 0;

  }
}
