import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { CartItem, Payment, PaymentMode, SALE_ACCOUNTS } from './cart.interface';
import { Member } from '../../../../../common/member.interface';
import { BookService } from '../../book.service';
import { ENTRY_TYPE, bank_values, Bookentry, operation_values, Operation, BOOK_ENTRY_CLASS, Session, FINANCIAL_ACCOUNT } from '../../../../../common/accounting.interface';
import { Product } from '../../../../../admin-dashboard/src/app/sales/products/product.interface';

@Injectable({
  providedIn: 'root'
})

export class CartService {
  private _cart: CartItem[] = [];
  private _cart$ = new BehaviorSubject<CartItem[]>(this._cart);

  private _payment!: Payment;

  private _debt: number = 0;
  private _asset: number = 0;

  constructor(
    private bookService: BookService,
  ) { }

  set payment(payment: Payment) {
    this._payment = payment;
  }
  get payment(): Payment {
    return this._payment;
  }

  get cart$(): Observable<CartItem[]> {
    return this._cart$.asObservable();
  }

  addToCart(CartItem: CartItem): void {
    this._cart.push(CartItem);
    this._cart$.next(this._cart);
    // this._complete_and_balanced.update(() => this.isCompleteAndBalanced());
  }

  removeFromCart(CartItem: CartItem): void {
    const index = this._cart.indexOf(CartItem);
    if (index > -1) {
      this._cart.splice(index, 1);
      this._cart$.next(this._cart);
      // this._complete_and_balanced.update(() => this.isCompleteAndBalanced());
    }
  }

  clearCart(): void {
    this._cart = [];
    // this._payment = { amount: 0, payer_id: '', mode: PaymentMode.CASH, bank: '', cheque_no: '' };
    this._debt = 0;
    this._cart$.next(this._cart);
    // this._payment$.next(this._payment);
    // this._complete_and_balanced.set(false);
  }

  setDebt(amount: number): void {
    this._debt = amount;
  }
  setAsset(amount: number): void {
    this._asset = amount;
  }

  getCartAmount(): number {
    return this._cart.reduce((total, item) => total + item.paied, 0) + this._debt - this._asset;
  }



  getCartItems(): CartItem[] {
    return this._cart;
  }

  save_sale(session: Session, buyer?: Member): Promise<Bookentry> {
    let promise = new Promise<Bookentry>((resolve, reject) => {
      const sale: Bookentry = {
        ...session,
        id: '',
        bank_op_type: this.payment_mode2bank_op_type(this._payment.mode),
        class: BOOK_ENTRY_CLASS.REVENUE_FROM_MEMBER,
        amounts: this.payments2fValue(this._payment.mode),
        operations: this.cart2Operations(),
        cheque_ref: this.payments2cheque_ref(this._payment),
      };
      let bank_op_type = this.payment_mode2bank_op_type(this._payment.mode);
      if (bank_op_type) {
        sale.bank_op_type = bank_op_type;
      }

      this.bookService.create_book_entry(sale)
        .then((sale) => {
          resolve(sale);
          console.log('sale saved', sale);
          this.clearCart();
        })
        .catch((error) => {
          console.error('error saving sale', error);
          reject(error);
        });
    });
    return promise;
  }

  build_cart_item(product: Product, payee: Member | null): CartItem {
    const cartItem: CartItem = {
      product_id: product.id,
      paied: product.price,
      payee_id: payee === null ? '' : payee.id,
      product_account: product.account,
      payee_name: payee === null ? '' : payee.lastname + ' ' + payee.firstname
    };
    return { payee: payee, ...cartItem }
  }


  cart2Operations(): Operation[] {
    let operations: Operation[] = [];
    let payees: Map<string, CartItem[]> = new Map();
    this._cart.forEach((cartitem) => {
      let payee = cartitem.payee_name;

      if (payees.has(payee)) {
        payees.get(payee)!.push(cartitem);
      } else {
        payees.set(payee, [cartitem]);
      }
    });

    for (let [payee, cartitems] of payees) {
      let op_values: operation_values = {};
      cartitems.forEach((cartitem) => {
        let account = cartitem.product_account;
        if (op_values[account]) {
          op_values[account] += cartitem.paied;
        } else {
          op_values[account] = cartitem.paied;
        }
      });
      let operation = {
        label: 'vente adhérent',
        member: payee,
        values: op_values,
      };
      // console.log('operation', operation);
      operations.push(operation);
    }
    return operations;
  }

  payment_mode2bank_op_type(payment_mode: PaymentMode): ENTRY_TYPE {
    if (payment_mode === PaymentMode.CREDIT) {
      return ENTRY_TYPE.debt_payment;
    }

    if (payment_mode === PaymentMode.CHEQUE) {
      return ENTRY_TYPE.cheque_payment;
    } else {
      if (payment_mode === PaymentMode.TRANSFER) {
        return ENTRY_TYPE.transfer_payment;
      }
    }
    return ENTRY_TYPE.cash_payment;
  }

  payments2cheque_ref(payment: Payment): string {
    if (payment.mode === PaymentMode.CHEQUE) {
      return payment.bank + payment.cheque_no;
    } else {
      return '';
    }
  }

  payments2fValue(payment_mode: PaymentMode): bank_values {
    let f_amounts: bank_values = {};

    f_amounts[SALE_ACCOUNTS[payment_mode]] = this.getCartAmount();

    if (this._debt !== 0) {
      f_amounts[FINANCIAL_ACCOUNT.DEBT_credit] = this._debt;  // paiement de la dette
    }
    if (this._asset !== 0) {
      f_amounts[FINANCIAL_ACCOUNT.ASSET_debit] = this._asset;  // paiement avec un avoir
    }
    return f_amounts;
  }


}
