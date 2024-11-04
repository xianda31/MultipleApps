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
import { PaymentMode, Sale, Session } from './sales.interface';
import { CartItem, Payment } from './cart/cart.interface';

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
  products_array!: [Product[]];
  debt_amount = 0;
  banks$ !: Observable<Bank[]>;
  sales: Sale[] = [];
  sales_of_the_day: Sale[] = [];
  paymentMode = PaymentMode;

  loading_complete = false;


  paymodes: PayMode[] = [
    { glyph: 'ESPECES', icon: 'bi bi-cash-coin', class: 'card nice_shadow bigger-on-hover bg-primary text-white', payment_mode: PaymentMode.CASH },
    { glyph: 'CHEQUE', icon: 'bi bi-bank', class: 'card nice_shadow bigger-on-hover bg-primary text-white', payment_mode: PaymentMode.CHEQUE },
    { glyph: 'VIREMENT', icon: 'bi bi-globe', class: 'card nice_shadow bigger-on-hover bg-primary text-white', payment_mode: PaymentMode.TRANSFER },
    { glyph: 'CREDIT', icon: 'bi bi-sticky', class: 'card nice_shadow bigger-on-hover bg-warning', payment_mode: PaymentMode.CREDIT },
    { glyph: 'AVOIR', icon: 'bi bi-gift', class: 'card nice_shadow bigger-on-hover bg-success text-white', payment_mode: PaymentMode.ASSETS },
  ]

  debt_product: Product = {
    id: 'debt',
    glyph: 'DETTE',
    description: 'dette',
    price: 0,
    account: 'DEBT',
    paired: false,
    active: true,
  }

  buyerForm: FormGroup = new FormGroup({
    buyer: new FormControl(null, Validators.required),
  });
  get buyer() { return this.buyerForm.get('buyer')?.value as Member | null }


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
      this.products_array = this.productService.products_array(products);
      this.session = session;
      this.sales_subscription = this.salesService.get_sales$(session.season).subscribe((sales) => {
        this.sales = sales;

        this.sales_of_the_day = sales.filter((sale) => sale.event === session.event);
        this.loading_complete = true;
      });
    });

    this.banks$ = this.systemDataService.configuration$.pipe(
      map((conf) => conf.banks)
    );

    this.buyerForm.valueChanges.subscribe((value) => {
      const buyer: Member | null = value['buyer'];
      // console.log('buyerForm.valueChanges', buyer);
      if (buyer === null) return;

      this.debt_amount = this.find_debt(buyer);
      if (this.debt_amount !== 0) {
        this.debt_product.price = this.debt_amount;
        this.toastService.showWarningToast('dette', 'cette personne a une dette de ' + this.debt_amount + ' €');
      }
    });

  }

  find_debt(payer: Member): number {
    const payer_sales = this.sales.filter((sale) => sale.payer_id === payer.id);
    let due = 0;
    payer_sales.forEach((sale) => {
      if (sale.records) {
        due += sale.records.filter((payment) => payment.mode === PaymentMode.CREDIT)
          .reduce((acc, payment) => acc + payment.amount, 0);
      }
    });
    console.log('dette', due);
    return due;
  }


  product_selected(product: Product) {

    let cart_item = (product: Product, payee: Member | null): CartItem => {
      const cartItem: CartItem = {
        // season: this.session.season,
        product_id: product.id,
        paied: product.price,
        payee_id: payee === null ? '' : payee.id,
      };
      return { payee: payee, ...cartItem }
    }

    if (!this.buyerForm.valid) {
      this.toastService.showWarningToast('saisie achat', 'selectionner au moins le bénéficiaire 1');
      return
    }

    if (product.paired) {
      const cart_item1 = cart_item(product, this.buyer);
      const cart_item2 = cart_item(product, null);
      this.cartService.addToCart(cart_item1);
      this.cartService.addToCart(cart_item2);
    } else {
      const cart_item1 = cart_item(product, this.buyer);
      this.cartService.addToCart(cart_item1);
    }
  }

  paymode_selected(paymode: PayMode) {
    if (!this.cart_is_valid || this.cartService.getCartItems().length === 0) {
      this.toastService.showWarningToast('saisie achat', 'le panier est vide ou partiellement renseigné');
      return
    }
    const amount = (paymode.payment_mode === PaymentMode.ASSETS) ? 25 : this.cartService.getRemainToPay();

    const payment: Payment = {
      payer_id: this.buyer!.id,
      mode: paymode.payment_mode,
      amount: amount,
    }
    this.cartService.addToPayments(payment);
  }

  sale_confirmed(): void {

    const payments = this.cartService.getPayments();
    console.log('payments', payments);
    this.cartService.save_sale(this.session, this.buyer!);
    this.buyerForm.reset();


    // this.salesService.writeOperation(sale).subscribe((res) => {
    //   // this.cartService.push_sale_of_the_day(sale);
    //   this.toastService.showSuccessToast('saisie achat', 'vente enregistrée');
    //   this.cartService.clearCart();
    //   this.sale = null;
    // });
  }



  renew_session(event: any) {
    this.session.event = event;
    this.sessionService.set_current_session(this.session);
  }

  member_name(member_id: string) {
    let member = this.members.find((m) => m.id === member_id);
    return member ? member.lastname + ' ' + member.firstname : '???';
  }

  product_account(product_id: string) {
    let product = this.products.find((p) => p.id === product_id);
    return product ? product.account : '???';
  }
  product_name(product_id: string) {
    let product = this.products.find((p) => p.id === product_id);
    return product ? product.account : '???';
  }
  sale_amount(sale: Sale) {
    if (!sale.records) return 0;
    return sale.records
      .filter((record) => record.class.includes('Product'))
      .reduce((total, record) => total + record.amount, 0);
  }
}
