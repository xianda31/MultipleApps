import { Component } from '@angular/core';
import { FormGroup, FormControl, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MembersService } from '../../../../../admin-dashboard/src/app/members/service/members.service';
import { Member } from '../../../../../common/member.interface';
import { ProductService } from '../../../../../common/services/product.service';
import { ToastService } from '../../../../../common/toaster/toast.service';
import { CartService } from '../../cart.service';
import { Product } from '../../../../../admin-dashboard/src/app/sales/products/product.interface';
import { ToasterComponent } from '../../../../../common/toaster/components/toaster/toaster.component';
import { CommonModule } from '@angular/common';
import { CartComponent } from '../../cart/cart.component';
import { InputMemberComponent } from '../../input-member/input-member.component';
import { AccountingService } from '../accounting.service';
import { map, Observable } from 'rxjs';
import { SystemDataService } from '../../../../../common/services/system-data.service';
import { Bank } from '../../../../../common/system-conf.interface';
import { SessionService } from '../session.service';
import { KeypadComponent } from '../../keypad/keypad.component';
import { Payment, PaymentMode, Sale, SaleItem, Session } from './sales.interface';
import { CartItem } from '../../cart/cart.interface';

interface PayMode {
  glyph: string;
  icon: string;
  class: string;
  payment_mode: PaymentMode;
}
@Component({
  selector: 'app-sales',
  standalone: true,
  imports: [ReactiveFormsModule, ToasterComponent, CommonModule, FormsModule, KeypadComponent, CartComponent, InputMemberComponent],
  templateUrl: './sales.component.html',
  styleUrl: './sales.component.scss'
})
export class SalesComponent {
  members!: Member[];
  session!: Session;

  cart_is_valid = true;

  sale: Sale | null = null;

  members_subscription: any;
  products_subscription: any;
  product_keys!: { [k: string]: Product[]; };
  banks$ !: Observable<Bank[]>;

  sales_of_the_day$ !: Observable<Sale[]>;
  paymentMode = PaymentMode;

  paymodes: PayMode[] = [
    { glyph: 'ESPECES', icon: 'bi bi-cash-coin', class: 'card nice_shadow bigger-on-hover bg-primary text-white', payment_mode: PaymentMode.CASH },
    { glyph: 'CHEQUE', icon: 'bi bi-bank', class: 'card nice_shadow bigger-on-hover bg-primary text-white', payment_mode: PaymentMode.CHEQUE },
    { glyph: 'VIREMENT', icon: 'bi bi-globe', class: 'card nice_shadow bigger-on-hover bg-primary text-white', payment_mode: PaymentMode.TRANSFER },
    { glyph: 'CREDIT', icon: 'bi bi-sticky', class: 'card nice_shadow bigger-on-hover bg-warning', payment_mode: PaymentMode.DEBT },
    { glyph: 'AVOIR', icon: 'bi bi-gift', class: 'card nice_shadow bigger-on-hover bg-success text-white', payment_mode: PaymentMode.ASSETS },
  ]



  payeesForm: FormGroup = new FormGroup({
    payee_1: new FormControl(null, Validators.required),
  });
  get payee_1() { return this.payeesForm.get('payee_1')!; }


  constructor(
    private cartService: CartService,
    private membersService: MembersService,
    private toastService: ToastService,
    private productService: ProductService,
    private accountingService: AccountingService,
    private systemDataService: SystemDataService,
    private sessionService: SessionService,
  ) {

  }

  ngOnDestroy(): void {
    // this.products_subscription.unsubscribe();
    // this.members_subscription.unsubscribe();

  }

  ngOnInit(): void {

    this.sales_of_the_day$ = this.cartService.sales_of_the_day$;


    this.banks$ = this.systemDataService.configuration$.pipe(
      map((conf) => conf.banks)
    );

    this.membersService.listMembers().subscribe((members) => {
      this.members = members.sort((a, b) => a.lastname.localeCompare(b.lastname))
        .map((member) => {
          member.lastname = member.lastname.toUpperCase();
          return member;
        });
    });

    this.productService.listProducts().subscribe((products) => {
      this.product_keys = this.sorted_products(products);
    });

    this.sessionService.current_session.subscribe((session) => {
      this.session = session;
    });
  }

  productSelected(product: Product) {

    let cart_item = (product: Product, payee: Member | null): CartItem => {
      const saleItem: SaleItem = {
        season: this.session.season,
        product_id: product.id,
        payed: product.price,
        payee_id: payee === null ? '' : payee.id,
      };
      return { payee: payee, ...saleItem }
    }

    if (!this.payee_1.valid) {
      this.toastService.showWarningToast('saisie achat', 'selectionner au moins le bénéficiaire 1');
      return
    }

    if (product.paired) {
      const cart_item1 = cart_item(product, this.payee_1.value);
      const cart_item2 = cart_item(product, null);
      this.cartService.addToCart(cart_item1);
      this.cartService.addToCart(cart_item2);
    } else {
      const cart_item1 = cart_item(product, this.payee_1.value);
      this.cartService.addToCart(cart_item1);
    }
  }

  paymode_selected(paymode: PayMode) {
    if (!this.cart_is_valid || this.cartService.getCartItems().length === 0) {
      this.toastService.showWarningToast('saisie achat', 'le panier est vide ou partiellement renseigné');
      return
    }

    if (paymode.payment_mode === PaymentMode.ASSETS) {
      const payment = {
        season: this.session.season,
        mode: paymode.payment_mode,
        amount: 12,
      }
      this.cartService.addToPayments(payment);
    } else {
      const payment = {
        season: this.session.season,
        mode: paymode.payment_mode,
        amount: this.cartService.getCartAmount(),
      }
      this.cartService.addToPayments(payment);

    }


    // this.sale = {
    //   ...this.session,
    //   amount: this.cartService.getCartAmount(),
    //   payer_id: this.payee_1.value.id,
    //   payments: [{
    //     season: this.session.season,
    //     mode: paymode.payment_mode,
    //     amount: this.cartService.getCartAmount(),
    //     bank: '',
    //     cheque_no: '',
    //   }],
    //   saleItems: this.cartService.getCartItems().map((item) => item)
    // }
  }

  save_cart(): void {

    const sale = {
      ...this.session,
      amount: this.cartService.getCartAmount(),
      payer_id: this.payee_1.value.id,
      payments: this.cartService.getPayments(),
      saleItems: this.cartService.getCartItems().map((item) => item)
    }

    this.accountingService.writeOperation(sale).subscribe((res) => {
      this.cartService.push_sale_of_the_day(sale);
      this.cartService.clearCart();
      this.toastService.showSuccessToast('saisie achat', 'vente enregistrée');
      this.payeesForm.reset();
      this.sale = null;
    });
  }



  renew_session() {
    this.sessionService.set_current_session(this.session);
    this.cartService.reset_sales_of_the_day();
  }

  member_name(member_id: string) {
    let member = this.membersService.getMember(member_id);
    return member ? member.lastname + ' ' + member.firstname : '???';
  }


  sorted_products(products: Product[]): { [k: string]: Product[]; } {
    products = products
      .filter((product) => product.active)
      .sort((a, b) => b.price - a.price);
    // reorder products by category
    const categories: Map<string, Product[]> = new Map();
    products.forEach((product) => {
      if (categories.has(product.category)) {
        categories.get(product.category)!.push(product);
      } else {
        categories.set(product.category, [product]);
      }
    });
    return Object.fromEntries(categories);;
  }
}
