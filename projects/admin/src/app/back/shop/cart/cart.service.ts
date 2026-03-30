import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Cart, CartItem, Payment, PaymentMode, SALE_ACCOUNTS } from './cart.interface';
import { Member } from '../../../common/interfaces/member.interface';
import { BookService } from '../../services/book.service';
import { TRANSACTION_ID, BookEntry, operation_values, Operation, Session, FINANCIAL_ACCOUNT, CUSTOMER_ACCOUNT, AMOUNTS } from '../../../common/interfaces/accounting.interface';
import { ProductService } from '../../../common/services/product.service';
import { GameCardService } from '../../services/game-card.service';
import { MembersService } from '../../../common/services/members.service';
import { Product } from '../../products/product.interface';

@Injectable({
  providedIn: 'root'
})

export class CartService {
  private _cart: Cart = { items: [], debt: null, asset_available: null, asset_used: null, buyer_name: '',take_asset:true,take_debt:true };
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
    this._cart.asset_available = null;
    this._cart.asset_used = null;
    this._cart.take_asset = true;
    this._cart.take_debt = true;
    this._cart.buyer_name = '';
    this._cart$.next(this._cart);
  }

  setDebt(name: string, amount: number): void {
    this._cart.debt = { name: name, amount: amount };
    this._cart$.next(this._cart);

  }
  setAsset(name: string, amount: number): void {
    this._cart.asset_available = { name: name, amount: amount };
    this._cart$.next(this._cart);
  }
  takeAsset(take: boolean): void {
    this._cart.take_asset = take;
    this._cart$.next(this._cart);
  }
  takeDebt(take: boolean): void {
    this._cart.take_debt = take;
    this._cart$.next(this._cart);
  }

  setBuyer(buyer_name: string): void {
    this._cart.buyer_name = buyer_name;
    this._cart$.next(this._cart);
  }

  setSeller(seller_name: string): void {
    this.seller = seller_name;
  }

  setTag(tag: string): void {
    this._cart.tag = tag;
  }

  setStripeTag(stripeTag: string): void {
    this._cart.stripeTag = stripeTag;
  }

  getCartAmount(): number {
    // console.log('getCartAmount', this._cart.debt, this._cart.asset);
    let due = this._cart.items.reduce((total, item) => total + item.paied, 0) + (this._cart.take_debt ? (this._cart.debt?.amount  || 0) : 0);

    if (this._cart.take_asset && this._cart.asset_available && this._cart.asset_available.amount > 0) {
      let asset_available = this._cart.asset_available.amount;
      let asset_used = (asset_available > due) ? due : asset_available;
      this._cart.asset_used = { name: this._cart.asset_available.name, amount: asset_used };
      due -= asset_used;
    }

    return due

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
        tag: this._cart.tag,
        stripeTag: this._cart.stripeTag,
        amounts: this.payments2fValue(this._payment.mode),
        operations: this.cart2Operations(),
        cheque_ref: this.payments2cheque_ref(this._payment),
      };
      let bank_op_type = this.payment_mode2bank_op_type(this._payment.mode);
      if (bank_op_type) {
        sale.transaction_id = bank_op_type;
      }

      // capture items snapshot to avoid concurrent modifications
      const itemsSnapshot = this._cart.items.slice();
      this.bookService.create_book_entry(sale)
        .then(async (sale) => {
          resolve(sale);
          // process game card creation using the snapshot (avoids race with clearCart)
          await this.handle_game_card(session, itemsSnapshot);
          this.clearCart();
        })
        .catch((error) => {
          reject(error);
        });
    });
    return promise;
  }

  build_cart_item(product: Product, payee: Member, paired_with?: Member): CartItem {
    const item: CartItem = {
      product_id: product.id,
      product_account: product.account,
      payee: payee,
      payee_name: payee.lastname + ' ' + payee.firstname,
      paied: product.price,   // prix total de l'achat (déjà total pour paired)
    };

    if (product.paired && paired_with) {
      item.paired_with = paired_with;
      item.paired_name = paired_with.lastname + ' ' + paired_with.firstname;
    }

    return item;
  }


  cart2Operations(): Operation[] {
    let operations: Operation[] = [];
    let payees: Map<string, CartItem[]> = new Map();

    this._cart.items.forEach((cartitem) => {
      const isShared = cartitem.paired_with && cartitem.product_account === 'CAR';

      if (isShared) {
        // Shared (CAR): une seule opération au nom des deux membres
        const sharedKey = cartitem.payee_name + ' / ' + cartitem.paired_name;
        const existing = payees.get(sharedKey) ?? [];
        existing.push(cartitem);
        payees.set(sharedKey, existing);
      } else if (cartitem.paired_with) {
        // Per-member (ADH-c, PERF-c): deux opérations distinctes à prix unitaire (= total / 2)
        const unitPrice = cartitem.paied / 2;
        const item1: CartItem = { ...cartitem, paied: unitPrice, paired_with: undefined, paired_name: undefined };
        const item2: CartItem = {
          ...cartitem,
          payee: cartitem.paired_with,
          payee_name: cartitem.paired_name!,
          paied: unitPrice,
          paired_with: undefined,
          paired_name: undefined,
        };
        [item1, item2].forEach(it => {
          const existing = payees.get(it.payee_name) ?? [];
          existing.push(it);
          payees.set(it.payee_name, existing);
        });
      } else {
        // Produit simple
        const existing = payees.get(cartitem.payee_name) ?? [];
        existing.push(cartitem);
        payees.set(cartitem.payee_name, existing);
      }
    });

    // push debt_credit and asset_debit as "CartItems"
    if (this._cart.debt && this._cart.take_debt) {
      let items = payees.get(this._cart.debt.name) ?? [];
      items.push({ payee: { lastname: this._cart.debt.name, firstname: '' } as any, paied: this._cart.debt.amount, product_account: CUSTOMER_ACCOUNT.DEBT_credit, payee_name: this._cart.debt.name, product_id: '' });
      payees.set(this._cart.debt.name, items);
    }
    if (this._cart.asset_used && this._cart.take_asset) {
      let items = payees.get(this._cart.asset_used.name) ?? [];
      items.push({ payee: { lastname: this._cart.asset_used.name, firstname: '' } as any, paied: this._cart.asset_used.amount, product_account: CUSTOMER_ACCOUNT.ASSET_debit, payee_name: this._cart.asset_used.name, product_id: '' });
      payees.set(this._cart.asset_used.name, items);
    }

    for (let [payee, cartitems] of payees) {
      let ops : Operation[] = [];
      let op_index = 0;
       ops[0] = {
         label: 'vendu par ' + this.seller,
        member: payee,
         values: {} as operation_values,
      };

      // génération d'une ligne operation si compte déjà utilisé même si même payee
      // permet de detecter les achats multiples par un même adhérent
      // ex: achat de 2 cartes de membre
      // chaque carte est une ligne dans la bd
      cartitems.forEach((cartitem) => {
        let account = cartitem.product_account;
        if (ops[op_index].values[account]) {
          op_index += 1;
          ops[op_index] = {
            label: 'vendu par ' + this.seller,
            member: payee,
            values: {} as operation_values,
          };
          ops[op_index].values[account] = cartitem.paied;
        } else {
          ops[op_index].values[account] = cartitem.paied;
        }
      });
      // paiement du panier à crédit
      if (payee === this._cart.buyer_name && this.payment.mode === PaymentMode.CREDIT) {
        ops[0].values[CUSTOMER_ACCOUNT.DEBT_debit] = this.getCartAmount();
      }
      // console.log('operation', operation);
      ops.forEach((operation) => {
        operations.push(operation);
      });
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


  async handle_game_card(session: Session, items?: CartItem[]) {
    const cartItems = items ?? this._cart.items;
    for (const cartitem of cartItems) {
      if (cartitem.product_account !== 'CAR') continue;

      const members: Member[] = [cartitem.payee];
      if (cartitem.paired_with) members.push(cartitem.paired_with);

      // Toujours MAX_STAMPS jetons au total (défaut de createCard)
      await this.gameCardService.createCard(members)
        .catch(error => {
          console.error('Error à la création de la carte', cartitem.payee_name, error);
        });
    }
  }
}
