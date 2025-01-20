import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { CartItem, Payment, PaymentMode, SALE_ACCOUNTS } from './cart.interface';
import { Member } from '../../../../../common/member.interface';
import { BookService } from '../../book.service';
import { BANK_OPERATION_TYPE, bank_values, Bookentry, operation_values, Operation, RECORD_CLASS, Session } from '../../../../../common/accounting.interface';

@Injectable({
  providedIn: 'root'
})

export class CartService {
  private _cart: CartItem[] = [];
  private _cart$ = new BehaviorSubject<CartItem[]>(this._cart);

  private _payments: Payment[] = [];
  private _payments$ = new BehaviorSubject<Payment[]>(this._payments);

  private _debt: number = 0;

  // _complete_and_balanced = signal(false);

  constructor(
    private bookService: BookService,
  ) { }


  // get complete_and_balanced$(): Signal<boolean> {
  //   return (this._complete_and_balanced);
  // }


  get payments$(): Observable<Payment[]> {
    return this._payments$.asObservable();
  }


  addToPayments(payment: Payment): void {

    this._payments.push(payment);
    this._payments$.next(this._payments);
    // this._complete_and_balanced.update(() => this.isCompleteAndBalanced());
  }

  removeFromPayments(payment: Payment): void {
    const index = this._payments.indexOf(payment);
    if (index > -1) {
      this._payments.splice(index, 1);
      this._payments$.next(this._payments);
    }
    // this._complete_and_balanced.update(() => this.isCompleteAndBalanced());
  }

  getPaymentsAmount(): number {
    return this._payments.reduce((total, item) => total + item.amount, 0);

  }
  getPayments(): Payment[] {
    return this._payments;
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
    this._payments = [];
    this._debt = 0;
    this._cart$.next(this._cart);
    this._payments$.next(this._payments);
    // this._complete_and_balanced.set(false);
  }

  setDebt(amount: number): void {
    this._debt = amount;
  }
  getCartAmount(): number {
    return this._cart.reduce((total, item) => total + item.paied, 0) + this._debt;
  }


  getRemainToPay(): number {
    return this.getCartAmount() - this.getPaymentsAmount();
  }

  getCreditAmount(): number {
    const debt = this._cart.filter((item) => item.product_id = 'debt').reduce((total, item) => total + item.paied, 0);
    if (debt !== 0) {
      console.log('debt in', this._cart.filter((item) => item.product_id = 'debt'));
    }
    console.log('debt', debt);
    return debt;
  }

  getCartItems(): CartItem[] {
    return this._cart;
  }

  isCompleteAndBalanced(): boolean {
    return (this._cart.every((item) => item.payee_id)) && (this.getCartAmount() !== 0) && (this.getRemainToPay() === 0);
  }


  save_sale(session: Session, buyer?: Member): Promise<Bookentry> {
    let promise = new Promise<Bookentry>((resolve, reject) => {
      const sale: Bookentry = {
        ...session,
        id: '',
        bank_op_type: this.payments2bank_op_type(this._payments),
        class: RECORD_CLASS.REVENUE_FROM_MEMBER,
        amounts: this.payments2fValue(this._payments),
        operations: this.cart2Operations(),
        cheque_ref: this.payments2cheque_ref(this._payments),
      };
      let bank_op_type = this.payments2bank_op_type(this._payments);
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

  payments2bank_op_type(payments: Payment[]): BANK_OPERATION_TYPE {
    if (payments.some((payment) => payment.mode === PaymentMode.CHEQUE)) {
      return BANK_OPERATION_TYPE.cheque_receipt;
    } else {
      if (payments.some((payment) => payment.mode === PaymentMode.TRANSFER)) {
        return BANK_OPERATION_TYPE.transfer_receipt;
      }
    }
    return BANK_OPERATION_TYPE.cash_receipt;
  }

  payments2cheque_ref(payments: Payment[]): string {
    let label = payments.reduce((label, payment) => label + payment.bank + payment.cheque_no, '');
    let payment = payments.find((payment) => payment.mode === PaymentMode.CHEQUE);
    if (payment) {
      return payment.bank + payment.cheque_no;
    } else {
      return '';
    }
  }

  payments2fValue(payments: Payment[]): bank_values {
    let f_amounts: bank_values = {};
    payments.forEach((payment) => {
      f_amounts[SALE_ACCOUNTS[payment.mode]] = payment.amount;
    });

    if (this._debt !== 0) {
      f_amounts['creance_out'] = this._debt;  // paiement de la dette
    }
    return f_amounts;
  }


}
