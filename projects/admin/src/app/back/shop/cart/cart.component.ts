import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CartService } from './cart.service';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { map, Observable } from 'rxjs';
import { Cart, CartItem, Payment, PaymentMode } from './cart.interface';
import { ProductService } from '../../../common/services/product.service';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Bank } from '../../../common/interfaces/system-conf.interface';
import { SystemDataService } from '../../../common/services/system-data.service';
import { Product } from '../../products/product.interface';
@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, CurrencyPipe],
  templateUrl: './cart.component.html',
  styleUrl: './cart.component.scss'
})
export class CartComponent {
  @Output() complete = new EventEmitter<void>();
  @Output() stripeCheckout = new EventEmitter<void>();
  @Output() assetUsableChange = new EventEmitter<number>();  // Émettre quand l'avoir utilisable change
  @Input() message: string = '';
  @Input() onlineMode = false;
  @Input() canEditPrice = false;  // Si false, modifier les prix est désactivé

  debt_amount = 0;
  asset_available = 0;
  asset_usable = 0;  // Avoir réellement utilisable (ne rend pas le total négatif)
  total_amount = signal(0);

  cart: Cart = { items: [], debt: null, asset_available: null, asset_used: null, buyer_name: '', take_asset:true, take_debt:true };
  products!: Product[];
  editingIndex: number | null = null;

  paymentMode = PaymentMode;
  selected_payment !: Payment;

  banks$ !: Observable<Bank[]>;

  constructor(
    private cartService: CartService,
    private productService: ProductService,
    private systemDataService: SystemDataService,

  ) { }


  ngOnInit(): void {

    this.clear_payment();

    this.productService.listProducts().subscribe((products) => {
      this.products = products;
    });
    this.banks$ = this.systemDataService.get_configuration().pipe(map((conf) => conf.banks));



    this.cartService.cart$.subscribe((cart) => {
      this.cart = cart;
      this.debt_amount = cart.debt?.amount || 0;
      this.asset_available = cart.asset_available?.amount || 0;
      this.cart.take_asset = cart.take_asset;
      this.cart.take_debt = cart.take_debt;

      if (this.cart.items.length === 0) {
        this.clear_payment();
      }
      this.total_amount.update(() => this.cartService.getCartAmount());
      // Calculer l'avoir réellement utilisable
      this.asset_usable = this.calculate_usable_asset();
      // Émettre le changement d'asset_usable pour que le parent (shop) puisse l'utiliser
      this.assetUsableChange.emit(this.asset_usable);

    });
  }

  calculate_usable_asset(): number {
    // Avoir utilisable = min(avoir_disponible, montant_brut_à_payer)
    // Montant brut = articles + dette (AVANT déduction d'avoir)
    if (!this.cart.take_asset || this.asset_available <= 0) return 0;
    
    // Calculer le montant brut (articles + dette)
    const items_total = this.cart.items.reduce((sum, item) => sum + item.paied, 0);
    const debt = (this.cart.take_debt && this.debt_amount > 0) ? this.debt_amount : 0;
    const gross_total = items_total + debt;
    
    // Avoir utilisable ne peut pas dépasser le montant brut à payer
    return Math.min(this.asset_available, Math.max(0, gross_total));
  }

  get_product_description(product_id: string): string {
    const product = this.products.find((product) => product.id === product_id);
    return product?.description || '???';
  }

  deleteCartItem(cart_item: CartItem) {
    this.cartService.deleteCartItem(cart_item);
  }

  updateCartItem(cart_item: CartItem) {
    // Vérifier les permissions : modification des prix autorisée seulement si canEditPrice
    if (!this.canEditPrice) {
      console.warn('Permission denied: user cannot edit prices');
      this.editingIndex = null;
      return;
    }
    this.cartService.updateCartItem(cart_item);
    this.editingIndex = null;
  }

  stripe_checkout_not_ready(): boolean {
    if (this.cart.items.length === 0 && this.debt_amount === 0) return true;
    // All items must have a valid payee
    // Paired items (paired_with) are already atomic — the 2nd member is always present
    return this.cart.items.some(item => !item.payee);
  }

  clear_payment() {
    this.selected_payment = {
      amount: 0,
      payer_id: '',
      mode: '' as unknown as PaymentMode,
      bank: '',
      cheque_no: ''
    }
  }

  getCartAmount() {
    return this.cartService.getCartAmount();
  }

  toggle_take_debt() {
    this.cartService.takeDebt(!this.cart.take_debt);
  }
  toggle_take_asset() {
    this.cartService.takeAsset(!this.cart.take_asset);
  }

  payment_mode_change() {
    this.cartService.payment = this.selected_payment;
  }

  validate_sale() {
    this.complete.emit();
    this.clear_payment();
    this.debt_amount = 0;
    this.asset_available = 0;

  }


  cart_is_not_valid(): boolean {
    // Cas spécial : dette compensée par avoir et paiement espèces
    if (
      this.debt_amount > 0 &&
      this.asset_available >= this.debt_amount &&
      this.total_amount() === 0 &&
      this.selected_payment.mode === PaymentMode.CASH
    ) {
      return false;
    }
    return !this.selected_payment.mode 
      || (this.cart.items.length === 0 && !(this.total_amount()>0))
      || (this.total_amount()<0)
      || (this.selected_payment.mode === PaymentMode.CHEQUE && (  !this.selected_payment.bank || !this.selected_payment.cheque_no) )
      || this.cart.items.some((item) => !item.payee);
  }

}
