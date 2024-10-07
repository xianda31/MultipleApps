import { Component } from '@angular/core';
import { FormGroup, FormControl, Validators, AbstractControl, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { MembersService } from '../../../../../admin-dashboard/src/app/members/service/members.service';
import { Member } from '../../../../../common/members/member.interface';
import { ProductService } from '../../../../../common/services/product.service';
import { ToastService } from '../../../../../common/toaster/toast.service';
import { CartService } from '../../cart.service';
import { PaymentMode, SaleItem, CartItem, Payment, Session } from '../../cart/cart.interface';
import { GetPaymentComponent } from '../get-payment/get-payment.component';
import { Product } from '../../../../../admin-dashboard/src/app/sales/products/product.interface';
import { ToasterComponent } from '../../../../../common/toaster/components/toaster/toaster.component';
import { CommonModule, formatDate } from '@angular/common';
import { KeypadComponent } from '../keypad/keypad.component';
import { CartComponent } from '../../cart/cart.component';
import { BookLoggerComponent } from '../../book-logger/book-logger.component';
import { InputMemberComponent } from '../../input-member/input-member.component';
import { AccountingService } from '../accounting.service';
import { GetEventComponent } from '../../get-event/get-event.component';
import { from, Observable } from 'rxjs';
import { SessionService } from '../../session/session.service';
import { SessionComponent } from '../../session/session.component';

@Component({
  selector: 'app-sales',
  standalone: true,
  imports: [ReactiveFormsModule, ToasterComponent, CommonModule, FormsModule, KeypadComponent, CartComponent, BookLoggerComponent, InputMemberComponent, SessionComponent],
  templateUrl: './sales.component.html',
  styleUrl: './sales.component.scss'
})
export class SalesComponent {
  [x: string]: any;
  title = 'cashier';
  // double_price = false;
  members!: Member[];
  buyer!: Member | null;
  // alt_payee_switch: boolean = false;
  session!: Session | null;
  paymentMode = PaymentMode;

  members_subscription: any;
  products_subscription: any;
  event_subscription: any;
  keypad: Product[] = [];

  payeesForm: FormGroup = new FormGroup({
    payee_1: new FormControl(null, Validators.required),
  });
  get payee_1() { return this.payeesForm.get('payee_1')!; }

  constructor(
    private sessionService: SessionService,
    private cartService: CartService,
    private membersService: MembersService,
    private toastService: ToastService,
    private productService: ProductService,
    private modalService: NgbModal,
    private accountingService: AccountingService,


  ) { }

  ngOnDestroy(): void {
    this.products_subscription.unsubscribe();
    this.members_subscription.unsubscribe();

  }

  ngOnInit(): void {

    this.members_subscription = this.membersService.listMembers().subscribe((members) => {
      this.members = members.sort((a, b) => a.lastname.localeCompare(b.lastname))
        .map((member) => {
          member.lastname = member.lastname.toUpperCase();
          return member;
        });
    });

    this.products_subscription = this.productService.listProducts().subscribe((products) => {
      this.keypad = products.filter((product) => product.active);
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

  checkout() {

    if (this.cartService.getQuantity() === 0) {
      this.toastService.showWarningToast('saisie achat', 'le panier est vide');
      return
    }

    let payment_in: Payment = {
      session_id: 'XXXXXXX',
      amount: this.cartService.getTotal(),
      payer_id: this.payee_1.value.id,
      payment_mode: PaymentMode.CASH,
    }

    this.confirm_payment(payment_in).subscribe((payment_out) => {

      if (payment_out === null) return;

      this.accountingService.writeOperation(payment_out).subscribe((res) => {
        this.sessionService.push_saleItems_in_session(payment_out);
        this.cartService.clearCart();
        this.toastService.showSuccessToast('saisie achat', 'vente enregistrée');
        this.payeesForm.reset();
      });
    });
  }

  confirm_payment(pre_payment: Payment): Observable<Payment | null> {
    const modalRef = this.modalService.open(GetPaymentComponent, { centered: true });
    modalRef.componentInstance.payment_in = pre_payment;
    return from(modalRef.result);
  }

  format_date(date: Date): string {
    return formatDate(date, 'EEEE d MMMM HH:00', 'fr-FR');
  }

  set_session(session: Session | null) {
    this.session = session;
  }

}
