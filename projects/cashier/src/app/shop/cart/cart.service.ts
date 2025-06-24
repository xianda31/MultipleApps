import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Cart, CartItem, Payment, PaymentMode, SALE_ACCOUNTS } from './cart.interface';
import { Member } from '../../../../../common/member.interface';
import { BookService } from '../../book.service';
import { TRANSACTION_ID, BookEntry, operation_values, Operation, Session, FINANCIAL_ACCOUNT, CUSTOMER_ACCOUNT, AMOUNTS } from '../../../../../common/accounting.interface';
import { Product } from '../../../../../admin-dashboard/src/app/sales/products/product.interface';
import { ProductService } from '../../../../../common/services/product.service';
import { MembersService } from '../../../../../admin-dashboard/src/app/members/service/members.service';
import { GameCardService } from '../../game-card.service';

@Injectable({
  providedIn: 'root'
})

export class CartService {
  private _cart: Cart = { items: [], debt: null, asset: null, buyer_name: '' };
  private _payment!: Payment;
  private _cart$: BehaviorSubject<Cart> = new BehaviorSubject<Cart>(this._cart);
  private seller: string = '';

  constructor(
    private bookService: BookService,
        private productService: ProductService,
        private membersService: MembersService,
        private gameCardService: GameCardService
    
  ) { }

  set payment(payment: Payment) {
    this._payment = payment;
  }
  get payment(): Payment {
    return this._payment;
  }

  get cart$(): Observable<Cart> {
    return this._cart$.asObservable();
  }

  addToCart(CartItem: CartItem): void {
    this._cart.items.push(CartItem);
    this._cart$.next(this._cart);
  }

  deleteCartItem(CartItem: CartItem): void {
    const index = this._cart.items.indexOf(CartItem);
    if (index > -1) {
      this._cart.items.splice(index, 1);
      this._cart$.next(this._cart);
    }
  }
  updateCartItem(CartItem: CartItem): void {
    const index = this._cart.items.findIndex(item => item.product_id === CartItem.product_id);
    if (index > -1) {
      this._cart.items[index] = CartItem;
      this._cart$.next(this._cart);
    } else {
      console.warn('CartItem not found in cart', CartItem);
    }
  }

  clearCart(): void {
    this._cart.items = [];
    this._cart.debt = null;
    this._cart.asset = null;
    this._cart$.next(this._cart);
  }

  setDebt(name: string, amount: number): void {
    this._cart.debt = { name: name, amount: amount };
    this._cart$.next(this._cart);

  }
  setAsset(name: string, amount: number): void {
    this._cart.asset = { name: name, amount: amount };
    this._cart$.next(this._cart);
  }

  setBuyer(buyer_name: string): void {
    this._cart.buyer_name = buyer_name;
    this._cart$.next(this._cart);
  }

  setSeller(seller_name: string): void {
    this.seller = seller_name;
  }

  getCartAmount(): number {
    // console.log('getCartAmount', this._cart.debt, this._cart.asset);
    return this._cart.items.reduce((total, item) => total + item.paied, 0) + (this._cart.debt?.amount || 0) - (this._cart.asset?.amount || 0);
  }



  getCartItems(): CartItem[] {
    return this._cart.items;
  }

  save_sale(session: Session, buyer?: Member): Promise<BookEntry> {
    let promise = new Promise<BookEntry>((resolve, reject) => {
      const sale: BookEntry = {
        ...session,
        id: '',
        transaction_id: this.payment_mode2bank_op_type(this._payment.mode),
        amounts: this.payments2fValue(this._payment.mode),
        operations: this.cart2Operations(),
        cheque_ref: this.payments2cheque_ref(this._payment),
      };
      let bank_op_type = this.payment_mode2bank_op_type(this._payment.mode);
      if (bank_op_type) {
        sale.transaction_id = bank_op_type;
      }

      this.bookService.create_book_entry(sale)
        .then((sale) => {
          resolve(sale);
          // console.log('sale saved', sale);
          this.handle_game_card(session);
          this.clearCart();
        })
        .catch((error) => {
          // console.error('error saving sale', error);
          reject(error);
        });
    });
    return promise;
  }

  build_cart_item(product: Product, payee: Member | null): CartItem {
    const cartItem: CartItem = {
      product_id: product.id,
      paied: product.price,
      mutable:false,
      product_account: product.account,
      payee_name: payee === null ? '' : payee.lastname + ' ' + payee.firstname
    };
    return { payee: payee, ...cartItem }
  }


  cart2Operations(): Operation[] {
    let operations: Operation[] = [];
    let payees: Map<string, CartItem[]> = new Map();
    this._cart.items.forEach((cartitem) => {
      let payee = cartitem.payee_name;

      if (payees.has(payee)) {
        payees.get(payee)!.push(cartitem);
      } else {
        payees.set(payee, [cartitem]);
      }
    });
    // push debt_credit and asset_debit as "CartItems"
    if (this._cart.debt) {
      let items = payees.get(this._cart.debt.name) ?? [];
      items.push({ paied: this._cart.debt.amount, mutable:false,product_account: CUSTOMER_ACCOUNT.DEBT_credit, payee_name: this._cart.debt.name, product_id: '' });
      payees.set(this._cart.debt.name, items);
    }
    if (this._cart.asset) {
      let items = payees.get(this._cart.asset.name) ?? [];
      items.push({ paied: this._cart.asset.amount, mutable:false,product_account: CUSTOMER_ACCOUNT.ASSET_debit, payee_name: this._cart.asset.name, product_id: '' });
      payees.set(this._cart.asset.name, items);
    }

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
      // paiement du panier à crédit
      if (payee === this._cart.buyer_name && this.payment.mode === PaymentMode.CREDIT) {
        op_values[CUSTOMER_ACCOUNT.DEBT_debit] = this.getCartAmount();
      }
      let operation = {
        label: 'vendu par ' + this.seller,
        member: payee,
        values: op_values,
      };
      // console.log('operation', operation);
      operations.push(operation);
    }

    return operations;
  }

  payment_mode2bank_op_type(payment_mode: PaymentMode): TRANSACTION_ID {
    if (payment_mode === PaymentMode.CREDIT) {
      return TRANSACTION_ID.achat_adhérent_en_espèces;
    }

    if (payment_mode === PaymentMode.CHEQUE) {
      return TRANSACTION_ID.achat_adhérent_par_chèque;
    } else {
      if (payment_mode === PaymentMode.TRANSFER) {
        return TRANSACTION_ID.achat_adhérent_par_virement;
      }
    }
    return TRANSACTION_ID.achat_adhérent_en_espèces;
  }

  payments2cheque_ref(payment: Payment): string | undefined {
    if (payment.mode === PaymentMode.CHEQUE) {
      return payment.bank + payment.cheque_no;
    } else {
      return undefined;
    }
  }

  payments2fValue(payment_mode: PaymentMode): AMOUNTS {
    let f_amounts: AMOUNTS = {};
    if (Object.values(FINANCIAL_ACCOUNT).includes(SALE_ACCOUNTS[payment_mode] as FINANCIAL_ACCOUNT)) {
      const account = SALE_ACCOUNTS[payment_mode] as FINANCIAL_ACCOUNT;
      f_amounts[account] = this.getCartAmount();
    }
    return f_amounts;
  }


  handle_game_card(session: Session) {
    this._cart.items.forEach((cartitem) => {
      if (cartitem.product_account === 'CAR') {
        if (!cartitem.payee || cartitem.payee === null) {
          console.warn('no payee for CAR product', cartitem);
          return;
        }
        let product = this.productService.getProduct( cartitem.product_id);
        let member = this.membersService.getMemberbyName(cartitem.payee_name);
        if (!product || !member) {
          console.warn('product or member not found for CAR product', cartitem);
          return;
        }
        this.gameCardService.createCard([member], +product.info1!).catch(error => {
          console.error('Error à la création de la carte', member.firstname, member.lastname, error);
        });
        
      }
    });
  }

}
