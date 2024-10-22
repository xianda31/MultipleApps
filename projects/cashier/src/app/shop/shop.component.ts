import { Component } from '@angular/core';
import { FormGroup, FormControl, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MembersService } from '../../../../admin-dashboard/src/app/members/service/members.service';
import { Member } from '../../../../common/member.interface';
import { ProductService } from '../../../../common/services/product.service';
import { ToastService } from '../../../../common/toaster/toast.service';
import { CartService } from './cart/cart.service';
import { Product } from '../../../../admin-dashboard/src/app/sales/products/product.interface';
import { ToasterComponent } from '../../../../common/toaster/components/toaster/toaster.component';
import { CommonModule } from '@angular/common';
import { CartComponent } from './cart/cart.component';
import { InputMemberComponent } from '../input-member/input-member.component';
import { SalesService } from './sales.service';
import { combineLatest, map, Observable } from 'rxjs';
import { SystemDataService } from '../../../../common/services/system-data.service';
import { Bank } from '../../../../common/system-conf.interface';
import { SessionService } from './session.service';
import { KeypadComponent } from './keypad/keypad.component';
import { PaymentMode, Sale, SaleItem, Session } from './sales.interface';
import { CartItem } from './cart/cart.interface';

interface PayMode {
  glyph: string;
  icon: string;
  class: string;
  payment_mode: PaymentMode;
}
@Component({
  selector: 'app-shop',
  standalone: true,
  imports: [ReactiveFormsModule, ToasterComponent, CommonModule, FormsModule, CartComponent, InputMemberComponent],
  templateUrl: './shop.component.html',
  styleUrl: './shop.component.scss'
})
export class ShopComponent {
  members!: Member[];
  session!: Session;

  cart_is_valid = true;

  sale: Sale | null = null;

  members_subscription: any;
  products_subscription: any;
  sales_subscription: any;
  products!: Product[];
  product_keys!: { [k: string]: Product[]; };
  banks$ !: Observable<Bank[]>;

  // sales_of_the_day$ !: Observable<Sale[]>;
  sales_of_the_day: Sale[] = [];
  paymentMode = PaymentMode;

  loading_complete = false;

  paymodes: PayMode[] = [
    { glyph: 'ESPECES', icon: 'bi bi-cash-coin', class: 'card nice_shadow bigger-on-hover bg-primary text-white', payment_mode: PaymentMode.CASH },
    { glyph: 'CHEQUE', icon: 'bi bi-bank', class: 'card nice_shadow bigger-on-hover bg-primary text-white', payment_mode: PaymentMode.CHEQUE },
    { glyph: 'VIREMENT', icon: 'bi bi-globe', class: 'card nice_shadow bigger-on-hover bg-primary text-white', payment_mode: PaymentMode.TRANSFER },
    { glyph: 'CREDIT', icon: 'bi bi-sticky', class: 'card nice_shadow bigger-on-hover bg-warning', payment_mode: PaymentMode.DEBT },
    { glyph: 'AVOIR', icon: 'bi bi-gift', class: 'card nice_shadow bigger-on-hover bg-success text-white', payment_mode: PaymentMode.ASSETS },
  ]



  buyerForm: FormGroup = new FormGroup({
    buyer: new FormControl(null, Validators.required),
  });
  get buyer() { return this.buyerForm.get('buyer')!; }


  constructor(
    private cartService: CartService,
    private membersService: MembersService,
    private toastService: ToastService,
    private productService: ProductService,
    private salesService: SalesService,
    private systemDataService: SystemDataService,
    private sessionService: SessionService,
  ) {

  }

  ngOnDestroy(): void {
    // this.products_subscription.unsubscribe();
    // this.members_subscription.unsubscribe();

  }

  ngOnInit(): void {


    combineLatest([this.membersService.listMembers(), this.productService.listProducts(), this.sessionService.current_session]).subscribe(([members, products, session]) => {
      this.members = members;
      this.products = products;
      this.product_keys = this.productService.products_array(products);
      this.session = session;
      this.sales_subscription = this.cartService.get_sales_of_the_day(session).subscribe((sales) => {
        this.sales_of_the_day = sales;
        console.log('sales of the day', sales);
        this.loading_complete = true;
      });
    });

    this.banks$ = this.systemDataService.configuration$.pipe(
      map((conf) => conf.banks)
    );

    // this.membersService.listMembers().subscribe((members) => {
    //   this.members = members;
    // });

    // this.productService.listProducts().subscribe((products) => {
    //   // this.products = products;
    //   this.product_keys = this.productService.products_array();
    // });

    // this.sessionService.current_session.subscribe((session) => {
    //   this.session = session;
    // });
  }



  productSelected(product: Product) {

    let cart_item = (product: Product, payee: Member | null): CartItem => {
      const saleItem: SaleItem = {
        season: this.session.season,
        product_id: product.id,
        paied: product.price,
        payee_id: payee === null ? '' : payee.id,
      };
      return { payee: payee, ...saleItem }
    }

    if (!this.buyer.valid) {
      this.toastService.showWarningToast('saisie achat', 'selectionner au moins le bénéficiaire 1');
      return
    }

    if (product.paired) {
      const cart_item1 = cart_item(product, this.buyer.value);
      const cart_item2 = cart_item(product, null);
      this.cartService.addToCart(cart_item1);
      this.cartService.addToCart(cart_item2);
    } else {
      const cart_item1 = cart_item(product, this.buyer.value);
      this.cartService.addToCart(cart_item1);
    }
  }

  paymode_selected(paymode: PayMode) {
    if (!this.cart_is_valid || this.cartService.getCartItems().length === 0) {
      this.toastService.showWarningToast('saisie achat', 'le panier est vide ou partiellement renseigné');
      return
    }

    if (paymode.payment_mode === PaymentMode.ASSETS) {
      const revenue = {
        season: this.session.season,
        mode: paymode.payment_mode,
        amount: 12,
        sale_id: this.sale?.id || '',
      }
      this.cartService.addToRevenues(revenue);
    } else {
      const revenue = {
        season: this.session.season,
        mode: paymode.payment_mode,
        amount: this.cartService.getRemainToPay(),
        sale_id: this.sale?.id || '',

      }
      this.cartService.addToRevenues(revenue);

    }

  }

  store_sale(): void {

    const sale: Sale = {
      ...this.session,
      amount: this.cartService.getCartAmount(),
      payer_id: this.buyer.value.id,
      revenues: this.cartService.getRevenues(),
      saleItems: this.cartService.getCartItems().map((item) => { delete item.payee; return item; }),
    }

    this.salesService.writeOperation(sale).subscribe((res) => {
      this.cartService.push_sale_of_the_day(sale);
      this.toastService.showSuccessToast('saisie achat', 'vente enregistrée');
      this.cartService.clearCart();
      this.sale = null;
      this.buyerForm.reset();
    });
  }



  renew_session(event: any) {
    this.session.event = event;
    console.log('renew session', this.session);
    this.sessionService.set_current_session(this.session);
  }

  member_name(member_id: string) {
    let member = this.members.find((m) => m.id === member_id);
    return member ? member.lastname + ' ' + member.firstname : '???';
  }

  product_category(product_id: string) {
    let product = this.products.find((p) => p.id === product_id);
    return product ? product.category : '???';
  }

}
