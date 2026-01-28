import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CartService } from './cart.service';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { map, Observable } from 'rxjs';
import { Cart, CartItem, Payment, PaymentMode } from './cart.interface';
import { ProductService } from '../../../common/services/product.service';
import { InputMemberComponent } from '../../input-member/input-member.component';
import { Member } from '../../../common/interfaces/member.interface';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Bank } from '../../../common/interfaces/system-conf.interface';
import { SystemDataService } from '../../../common/services/system-data.service';
import { Product } from '../../products/product.interface';
import { MembersService } from '../../../common/services/members.service';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, InputMemberComponent, CurrencyPipe],
  templateUrl: './cart.component.html',
  styleUrl: './cart.component.scss'
})
export class CartComponent {
  @Output() complete = new EventEmitter<void>();
  @Input() message: string = '';

  debt_amount = 0;
  asset_available = 0;
  total_amount = signal(0);

  cart: Cart = { items: [], debt: null, asset_available: null, asset_used: null, buyer_name: '', take_asset:true, take_debt:true };
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
      this.asset_available = cart.asset_available?.amount || 0;
      this.cart.take_asset = cart.take_asset;
      this.cart.take_debt = cart.take_debt;

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

  deleteCartItem(cart_item: CartItem) {
    this.cartService.deleteCartItem(cart_item);
  }

  updateCartItem(cart_item: CartItem) {
    this.cartService.updateCartItem(cart_item);
    cart_item.mutable = false;
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

  toggle_take_debt() {
    this.cartService.takeDebt(!this.cart.take_debt);
  }
  toggle_take_asset() {
    this.cartService.takeAsset(!this.cart.take_asset);
  }

  payment_mode_change() {
    this.cartService.payment = this.selected_payment;
  }

  validate_sale() {
    this.complete.emit();
    this.clear_payment();
    this.debt_amount = 0;
    this.asset_available = 0;

  }


  cart_is_not_valid(): boolean {
    // Cas spécial : dette compensée par avoir et paiement espèces
    if (
      this.debt_amount > 0 &&
      this.asset_available >= this.debt_amount &&
      this.total_amount() === 0 &&
      this.selected_payment.mode === PaymentMode.CASH
    ) {
      return false;
    }
    return !this.selected_payment.mode 
      || (this.cart.items.length === 0 && !(this.total_amount()>0))
      || (this.total_amount()<0)
      || (this.selected_payment.mode === PaymentMode.CHEQUE && (  !this.selected_payment.bank || !this.selected_payment.cheque_no) )
      || this.cart.items.some((item) => !item.payee);
  }

}
