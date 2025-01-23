import { Component, computed, signal } from '@angular/core';
import { FormGroup, FormControl, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MembersService } from '../../../../admin-dashboard/src/app/members/service/members.service';
import { Member } from '../../../../common/member.interface';
import { ToastService } from '../../../../common/toaster/toast.service';
import { CartService } from './cart/cart.service';
import { Product } from '../../../../admin-dashboard/src/app/sales/products/product.interface';
import { CommonModule } from '@angular/common';
import { InputMemberComponent } from '../input-member/input-member.component';
import { SessionService } from './session.service';
import { CartItem, Payment, PaymentMode } from './cart/cart.interface';
import { Bookentry, Revenue, Session } from '../../../../common/accounting.interface';
import { BookService } from '../book.service';
import { KeypadComponent } from "./keypad/keypad.component";
import { CartComponent } from "./cart/cart.component";


@Component({
  selector: 'app-shop',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, FormsModule, InputMemberComponent, KeypadComponent, CartComponent],
  templateUrl: './shop.component.html',
  styleUrl: './shop.component.scss'
})
export class ShopComponent {
  members!: Member[];

  cart_is_valid = true;

  session !: Session;
  debt_amount = 0;
  asset_amount = 0;

  sales: Bookentry[] = [];

  day = signal(new Date().toISOString().split('T')[0]);
  sales_to_members = signal<Revenue[]>([]);
  sales_of_the_day = computed(() => {
    return this.sales_to_members().filter((revenue) => revenue.date === this.day());
  });

  buyerForm: FormGroup = new FormGroup({
    buyer: new FormControl(null, Validators.required),
  });
  get buyer() { return this.buyerForm.get('buyer')?.value as Member | null }


  constructor(
    private cartService: CartService,
    private membersService: MembersService,
    private toastService: ToastService,
    private bookService: BookService,
    private sessionService: SessionService,
  ) {

    this.bookService.list_book_entries$().subscribe((book_entry) => {
      this.sales = book_entry;
      this.sales_to_members.set(this.bookService.get_revenues_from_members());
    });
  }


  ngOnInit(): void {

    this.membersService.listMembers().subscribe((members) => {
      this.members = members;
    });

    this.sessionService.current_session.subscribe((session) => {
      this.session = session;
    });

    this.buyerForm.valueChanges.subscribe(async (value) => {
      const buyer: Member | null = value['buyer'];
      if (buyer === null) return;

      this.debt_amount = await this.find_debt(buyer);
      if (this.debt_amount !== 0) {
        this.toastService.showWarningToast('dette', 'cette personne a une dette de ' + this.debt_amount.toFixed(2) + ' €');
      }

      this.asset_amount = await this.find_assets(buyer);
      if (this.asset_amount !== 0) {
        this.toastService.showInfoToast('avoir', 'cette personne a un avoir de ' + this.asset_amount.toFixed(2) + ' €');
      }

      this.cartService.clearCart();
    });

  }

  find_debt(payer: Member): Promise<number> {
    let name = payer.lastname + ' ' + payer.firstname;
    let due = this.bookService.find_debt(name);
    return Promise.resolve(due);
  }

  find_assets(payer: Member): Promise<number> {
    let name = payer.lastname + ' ' + payer.firstname;
    let due = this.bookService.find_assets(name);
    return Promise.resolve(due);
  }

  product_selected(event: any) {
    const product = event as Product;
    let cart_item = (product: Product, payee: Member | null): CartItem => {
      const cartItem: CartItem = {
        product_id: product.id,
        paied: product.price,
        payee_id: payee === null ? '' : payee.id,
        product_account: product.account,
        payee_name: payee === null ? '' : payee.lastname + ' ' + payee.firstname
      };
      return { payee: payee, ...cartItem }
    }

    if (!this.buyerForm.valid) {
      this.toastService.showWarningToast('saisie achat', 'selectionner un acheteur');
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


  paymode_selected(event: any) {
    const payment_mode = event as PaymentMode;
    if (!this.cart_is_valid || (this.cartService.getCartItems().length === 0 && this.debt_amount === 0)) {
      this.toastService.showWarningToast('saisie achat', 'le panier est vide ou partiellement renseigné');
      return
    }
    const amount = (payment_mode === PaymentMode.ASSETS) ? this.asset_amount : this.cartService.getRemainToPay();
    this.asset_amount = (payment_mode === PaymentMode.ASSETS) ? 0 : this.asset_amount;

    const payment: Payment = {
      payer_id: this.buyer!.id,
      mode: payment_mode,
      bank: '',
      cheque_no: '',
      amount: amount,
    }
    this.cartService.addToPayments(payment);
  }

  cart_confirmed(): void {
    this.cartService.save_sale(this.session, this.buyer!)
      .then((sale) => {
        this.toastService.showSuccessToast('vente', (this.debt_amount > 0) ? 'achats et dette enregistrés' : 'achats enregistrés');
        this.sales_to_members.set(this.bookService.get_revenues_from_members());
      })
      .catch((error) => {
        console.error('error saving sale', error);
      });
    this.buyerForm.reset();
  }

  clear_sale(): void {
    this.cartService.clearCart();
    this.buyerForm.reset();
    this.debt_amount = 0;
  }

  date_change(date: any) {
    this.session.date = date;
    this.day.set(date);

    this.sessionService.set_current_session(this.session);
    this.cartService.clearCart();
    this.buyerForm.reset();
  }

  member_name(member_id: string) {
    let member = this.members.find((m) => m.id === member_id);
    return member ? member.lastname + ' ' + member.firstname : '???';
  }

  sale_value(sale: Revenue) {
    if (!sale.values) return 0;
    return Object.values(sale.values).reduce((total, value) => total + value, 0);
  }

  payment_type(sale: Revenue): string {
    let book_entry = this.sales.find((entry) => entry.id === sale.id);
    return book_entry ? book_entry.bank_op_type : '???';
  }
}
