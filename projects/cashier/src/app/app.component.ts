import { registerLocaleData, CommonModule, JsonPipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterModule, RouterOutlet } from '@angular/router';
import localeFr from '@angular/common/locales/fr';
import { KeypadComponent } from "./sales/keypad/keypad.component";
import { NavbarComponent } from './navbar/navbar.component';
import { ToasterComponent } from '../../../common/toaster/components/toaster/toaster.component';
import { CartComponent } from './cart/cart.component';
import { Product } from '../../../admin-dashboard/src/app/sales/products/product.interface';
import { CartService } from './cart.service';
import { MembersService } from '../../../admin-dashboard/src/app/members/service/members.service';
import { Member } from '../../../common/members/member.interface';
import { AbstractControl, Form, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ToastService } from '../../../common/toaster/toast.service';
import { CartItem, Payment, PaymentMode, Sale } from './cart/cart.interface';
import { ProductService } from '../../../common/services/product.service';
import { InputMemberComponent } from "./input-member/input-member.component";
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { GetPaymentComponent } from './sales/get-payment/get-payment.component';
import { BookLoggerComponent } from './book-logger/book-logger.component';
import { AccountingService } from './sales/accounting.service';



@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterModule, ReactiveFormsModule, NavbarComponent, ToasterComponent, CommonModule, FormsModule, KeypadComponent, CartComponent, BookLoggerComponent, InputMemberComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  [x: string]: any;
  title = 'cashier';
  season = '2024/25';
  double_price = false;
  members!: Member[];
  buyer!: Member | null;

  paymentMode = PaymentMode;


  products_subscription: any;
  keypad: Product[] = [];

  payeesForm: FormGroup = new FormGroup({
    payee_1: new FormControl('', Validators.required),
    payee_2: new FormControl('', Validators.required),
  });
  get payee_1() { return this.payeesForm.get('payee_1')!; }
  get payee_2() { return this.payeesForm.get('payee_2')!; }

  constructor(
    private cartService: CartService,
    private membersService: MembersService,
    private toastService: ToastService,
    private productService: ProductService,
    private modalService: NgbModal,

  ) { }

  ngOnInit(): void {
    // registerLocaleData(localeFr);

    this.membersService.listMembers().subscribe((members) => {
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

  clear(frmctrl: AbstractControl) {
    console.log('clear', frmctrl);
    this.payee_1.reset();
    frmctrl.reset();
  }

  keyStroked(product: Product | null) {
    if (!this.payee_1.valid) {
      this.toastService.showWarningToast('saisie achat', 'selectionner un bénéficiaire');
      return
    }

    if (!product) {
      this.cartService.clearCart();
      return
    }
    if (product.paired) {

      if (!this.payee_2.valid) {
        this.toastService.showWarningToast('saisie achat', 'selectionner le 2eme bénéficiaire');
        return
      }

      const sale1: Sale = {
        season: this.season,
        product_id: product.id,
        price_payed: product.price,
        payee_id: this.payee_1.value.id,
      };

      let cart_item1: CartItem = {
        product_glyph: product.glyph,
        payee_fullname: this.payee_1.value.lastname + ' ' + this.payee_1.value.firstname,
        sale: sale1
      }
      this.cartService.addToCart(cart_item1);

      const sale2: Sale = {
        season: this.season,
        product_id: product.id,
        price_payed: product.price,
        payee_id: this.payee_2.value.id,
      };

      let cart_item2: CartItem = {
        product_glyph: product.glyph,
        payee_fullname: this.payee_2.value.lastname + ' ' + this.payee_2.value.firstname,
        sale: sale2
      }
      this.cartService.addToCart(cart_item2);



    } else {

      const sale1: Sale = {
        season: this.season,
        product_id: product.id,
        price_payed: product.price,
        payee_id: this.payee_1.value.id,
      };

      let cart_item1: CartItem = {
        product_glyph: product.glyph,
        payee_fullname: this.payee_1.value.lastname + ' ' + this.payee_1.value.firstname,
        sale: sale1
      }
      this.cartService.addToCart(cart_item1);
    }
  }

  checkout() {

    if (this.cartService.getQuantity() === 0) {
      this.toastService.showWarningToast('saisie achat', 'le panier est vide');
      return
    }
    const modalRef = this.modalService.open(GetPaymentComponent, { centered: true });

    let payment_in: Payment = {
      season: '2024/25',
      amount: this.cartService.getTotal(),
      payer_id: this.payee_1.value.id,
      payment_mode: PaymentMode.CASH,
    }


    modalRef.componentInstance.payment_in = payment_in;
    modalRef.componentInstance.buyer_fullname = this.payee_1.value.lastname + ' ' + this.payee_1.value.firstname;

    modalRef.result.then((payment: string) => {
      if (payment === null) return;
      console.log('payment', payment);
    });
  }

  fullname(member: Member): string {
    return member.lastname + ' ' + member.firstname;
  }

}
