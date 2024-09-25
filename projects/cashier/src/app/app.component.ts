import { registerLocaleData, CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import localeFr from '@angular/common/locales/fr';
import { KeypadComponent } from "./keypad/keypad.component";
import { NavbarComponent } from './navbar/navbar.component';
import { ToasterComponent } from '../../../common/toaster/components/toaster/toaster.component';
import { CartComponent } from './cart/cart.component';
import { Product } from '../../../admin-dashboard/src/app/sales/products/product.interface';
import { CartService } from './cart.service';
import { MembersService } from '../../../admin-dashboard/src/app/members/service/members.service';
import { Member } from '../../../common/members/member.interface';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../../../common/toaster/toast.service';
import { CartItem } from './cart/cart.interface';
import { ProductService } from '../../../common/services/product.service';
import { PaymentComponent } from './payment/payment.component';


@Component({
  selector: 'app-root',
  standalone: true,
  imports: [NavbarComponent, ToasterComponent, CommonModule, FormsModule, KeypadComponent, CartComponent, PaymentComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  [x: string]: any;
  title = 'cashier';
  double_price = false;
  members!: Member[];
  buyer!: Member | null;

  products_subscription: any;
  keypad: Product[] = [];

  constructor(
    private cartService: CartService,
    private membersService: MembersService,
    private toastService: ToastService,
    private productService: ProductService
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

  buyerSelected(event: any) {
    // console.log('Selected buyer:', event.target.value);
    let id = event.target.value;
    this.buyer = this.members.find((member) => member.id === id) ?? null;
    // console.log('this.buyer', this.buyer);
  }

  keyStroked(product: Product | null) {
    if (!this.buyer) {
      this.toastService.showWarningToast('saisie achat', 'selectionner un bénéficiaire');
      return
    }
    if (product) {
      let cart_item: CartItem = { payee_id: this.buyer.id, payee_fullname: this.buyer.lastname + ' ' + this.buyer.firstname, article: { product_glyph: product.glyph, product_id: product.id, price: product.price } };
      this.cartService.addToCart(cart_item);
    } else {
      this.cartService.clearCart();
    }
  }
}
