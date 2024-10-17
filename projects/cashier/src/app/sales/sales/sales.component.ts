import { Component } from '@angular/core';
import { FormGroup, FormControl, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { MembersService } from '../../../../../admin-dashboard/src/app/members/service/members.service';
import { Member } from '../../../../../common/members/member.interface';
import { ProductService } from '../../../../../common/services/product.service';
import { ToastService } from '../../../../../common/toaster/toast.service';
import { CartService } from '../../cart.service';
import { PaymentMode, SaleItem, CartItem, Payment, Session, Sale } from './cart/cart.interface';
import { GetPaymentComponent } from '../get-payment/get-payment.component';
import { Product } from '../../../../../admin-dashboard/src/app/sales/products/product.interface';
import { ToasterComponent } from '../../../../../common/toaster/components/toaster/toaster.component';
import { CommonModule, formatDate } from '@angular/common';
import { CartComponent } from './cart/cart.component';
import { BookLoggerComponent } from '../../book-logger/book-logger.component';
import { InputMemberComponent } from '../../input-member/input-member.component';
import { AccountingService } from '../accounting.service';
import { combineLatest, from, Observable } from 'rxjs';
import { AuthentificationService } from '../../../../../common/authentification/authentification.service';
import { SystemDataService } from '../../../../../common/services/system-data.service';
import { KeypadComponent } from '../keypad/keypad.component';
import { Bank } from '../../../../../common/system-conf.interface';

interface PayMode {
  glyph: string;
  icon: string;
  class: string;
  payment_mode: PaymentMode;
}
@Component({
  selector: 'app-sales',
  standalone: true,
  imports: [ReactiveFormsModule, ToasterComponent, CommonModule, FormsModule, KeypadComponent, CartComponent, BookLoggerComponent, InputMemberComponent],
  templateUrl: './sales.component.html',
  styleUrl: './sales.component.scss'
})
export class SalesComponent {
  title = 'cashier';
  members!: Member[];
  buyer!: Member | null;

  session!: Session;
  season !: string;
  vendor!: Member;

  input_disabled = true;
  today: string = "";
  cart_is_valid = true;
  sale: Sale | null = null;

  members_subscription: any;
  products_subscription: any;
  event_subscription: any;
  products: Product[] = [];
  products_sorted_by_category!: { [k: string]: Product[]; };
  banks !: Bank[];

  payments: Payment[] = [];
  paymentMode = PaymentMode;
  paymodes: PayMode[] = [
    { glyph: 'ESPECES', icon: 'bi bi-cash-coin', class: 'card nice_shadow bigger-on-hover bg-primary text-white', payment_mode: PaymentMode.CASH },
    { glyph: 'CHEQUE', icon: 'bi bi-bank', class: 'card nice_shadow bigger-on-hover bg-primary text-white', payment_mode: PaymentMode.CHEQUE },
    { glyph: 'VIREMENT', icon: 'bi bi-globe', class: 'card nice_shadow bigger-on-hover bg-primary text-white', payment_mode: PaymentMode.TRANSFER },
    { glyph: 'CREDIT', icon: 'bi bi-sticky', class: 'card nice_shadow bigger-on-hover bg-warning', payment_mode: PaymentMode.DEBT },
    { glyph: 'AVOIR', icon: 'bi bi-gift', class: 'card nice_shadow bigger-on-hover bg-success text-white', payment_mode: PaymentMode.ASSETS },
  ]

  checkForm: FormGroup = new FormGroup({
    bank: new FormControl('', Validators.required),
    cheque_no: new FormControl('', [Validators.pattern(/^\d{6}$/), Validators.required])
  });
  get bank() { return this.checkForm.get('bank')!; }
  get cheque_no() { return this.checkForm.get('cheque_no')!; }

  payeesForm: FormGroup = new FormGroup({
    payee_1: new FormControl(null, Validators.required),
  });
  get payee_1() { return this.payeesForm.get('payee_1')!; }

  sales_of_the_day$ !: Observable<Sale[]>;

  constructor(
    private cartService: CartService,
    private membersService: MembersService,
    private toastService: ToastService,
    private productService: ProductService,
    private modalService: NgbModal,
    private accountingService: AccountingService,
    private authService: AuthentificationService,
    private systemDataService: SystemDataService


  ) {

  }

  ngOnDestroy(): void {
    // this.products_subscription.unsubscribe();
    // this.members_subscription.unsubscribe();

  }

  ngOnInit(): void {


    this.today = new Date().toLocaleDateString('en-CA');

    this.sales_of_the_day$ = this.cartService.sales_of_the_day;

    this.systemDataService.configuration$.subscribe((conf) => {
      this.banks = conf.banks;
    });

    combineLatest([this.membersService.listMembers(), this.productService.listProducts(), this.systemDataService.configuration$, this.authService.logged_member$]).subscribe(([members, products, conf, logged]) => {
      this.members = members.sort((a, b) => a.lastname.localeCompare(b.lastname))
        .map((member) => {
          member.lastname = member.lastname.toUpperCase();
          return member;
        });
      this.products = products
        .filter((product) => product.active)
        .sort((a, b) => b.price - a.price);

      this.products_sorted_by_category = this.sort_products_by_category();

      this.season = conf.season;

      if (logged === null) return;
      this.vendor = logged;

      console.log('vendor', this.vendor);

      this.session = {
        season: this.season,
        vendor: this.vendor.firstname + ' ' + this.vendor.lastname,
        event: new Date().toLocaleDateString('en-CA'),
      }
    });

  }

  keyStroked(product: Product) {
    if (!this.payee_1.valid) {
      this.toastService.showWarningToast('saisie achat', 'selectionner au moins le bénéficiaire 1');
      return
    }

    if (product.paired) {
      const cart_item1 = this.set_cart_item(product, this.payee_1.value);
      const cart_item2 = this.set_cart_item(product, null);
      this.cartService.addToCart(cart_item1);
      this.cartService.addToCart(cart_item2);
    } else {
      const cart_item = this.set_cart_item(product, this.payee_1.value);
      this.cartService.addToCart(cart_item);
    }
  }

  set_cart_item(product: Product, payee: Member | null): CartItem {
    const saleItem: SaleItem = {
      product_id: product.id,
      price_payed: product.price,
      payee_id: payee === null ? '' : payee.id,
    };

    return {
      product_glyph: product.glyph,
      payee: payee,
      saleItem: saleItem
    }

  }

  sort_products_by_category(): { [k: string]: Product[]; } {
    // sort products by category
    const categories: Map<string, Product[]> = new Map();
    this.products.forEach((product) => {
      if (categories.has(product.category)) {
        categories.get(product.category)!.push(product);
      } else {
        categories.set(product.category, [product]);
      }
    });
    return Object.fromEntries(categories);;
  }

  paymode_selected(paymode: PayMode) {
    if (!this.cart_is_valid || this.cartService.getQuantity() === 0) {
      this.toastService.showWarningToast('saisie achat', 'le panier est vide ou partiellement renseigné');
      return
    }
    this.sale = {
      session: this.session,
      amount: this.cartService.getTotal(),
      payer_id: this.payee_1.value.id,
      payment: {
        payment_mode: paymode.payment_mode,
        bank: '',
        cheque_no: '',
        cross_checked: false,
      },
      saleItems: this.cartService.getCartItems().map((item) => item.saleItem)
    }

    console.log('sale', this.sale);

  }

  valid_sale(sale: Sale): void {
    this.accountingService.writeOperation(sale).subscribe((res) => {
      this.cartService.push_saleItems_in_session(sale);
      this.cartService.clearCart();
      this.toastService.showSuccessToast('saisie achat', 'vente enregistrée');
      this.payeesForm.reset();
      this.sale = null;
    });
  }

  check_validated() {
    this.sale!.payment.bank = this.bank.value;
    this.sale!.payment.cheque_no = this.cheque_no.value;
    this.valid_sale(this.sale!);
  }


  format_date(date: Date): string {
    // return formatDate(date, 'EEEE d MMMM HH:00', 'fr-FR');
    return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric' });
  }
  string_to_date(date: string): Date {
    return new Date(date);
  }

  async set_session(session: Session | null) {
    // this.session = session;
    // if (session !== null) {
    //   const sessions = await this.sessionService.search_sessions(session);
    //   if (sessions.length === 0) {
    //     this.session = await this.sessionService.create_session(session);
    //   } else {
    //     // this.session = sessions[0];
    //     this.toastService.showWarningToast('session', 'reprise d\'une session existante');
    //     this.session = await this.sessionService.update_session(sessions[0]);
    //   }
    // }
  }


  getTotal() {
    return this.cartService.getTotal();
  }
  renew_session() {
    this.input_disabled = false;
  }

  member_name(member_id: string) {
    let member = this.membersService.getMember(member_id);
    return member ? member.lastname + ' ' + member.firstname : '???';
  }

}
