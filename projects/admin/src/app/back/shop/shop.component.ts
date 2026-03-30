import { Component, Input } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormGroup, FormControl, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { filter } from 'rxjs';
import { LicenseStatus, Member } from '../../common/interfaces/member.interface';
import { CartService } from './cart/cart.service';
import { CommonModule } from '@angular/common';
import { InputMemberComponent } from '../input-member/input-member.component';
import { Expense, Revenue, Session } from '../../common/interfaces/accounting.interface';
import { AuthentificationService } from '../../common/authentification/authentification.service';
import { Product } from '../products/product.interface';
import { CartComponent } from './cart/cart.component';
import { MembersService } from '../../common/services/members.service';
import { ToastService } from '../../common/services/toast.service';
import { MoveToEndPipe } from '../../common/pipes/move-to-end.pipe';
import { resolveGlyph } from '../../common/utilities/account-glyph.mapper';
import { StripeCheckoutOrchestrator } from './stripe-checkout/stripe-checkout.orchestrator';
import { ShopInitializationService } from './services/shop-initialization.service';
import { BuyerContextService } from './services/buyer-context.service';
import { ShopProductService } from './services/shop-product.service';


@Component({
  selector: 'app-shop',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, FormsModule, InputMemberComponent, CartComponent,  MoveToEndPipe],
  templateUrl: './shop.component.html',
  styleUrl: './shop.component.scss'
})
export class ShopComponent {
  @Input() member_id: string | null = null;
  @Input() onlineMode = false;
  members!: Member[];

  cart_is_valid = true;
  license_paied = false;
  membership_paied = false;
  message: string = '';

  session: Session = { date: '', season: '', };
  debt_amount = 0;
  asset_amount = 0;

  operations: (Revenue | Expense)[] = [];

  products_array: Map<string, Product[]> = new Map();

  logged_member: Member | null = null;
  canEditPrice = false;  // Autorisé pour Admin, Editor, System seulement
  private allProducts: Product[] = [];
  isSaving: boolean = false;  // For non-Stripe cart confirmation
  private stripeCheckoutPrepared = false;  // Éviter les doublons

  // STRIPE OBSERVABLES (from orchestrator) - as getters to avoid initialization order issues
  get isProcessing$() { return this.stripeCheckout.isProcessing$; }
  get isSuccess$() { return this.stripeCheckout.isSuccess$; }
  get receiptUrl$() { return this.stripeCheckout.receiptUrl$; }
  get shouldShowSpinner$() { return this.stripeCheckout.shouldShowSpinner$; }
  get shouldShowSuccess$() { return this.stripeCheckout.shouldShowSuccess$; }
  onlineSuccesUrl = `${window.location.origin}/front/mes_achats/achat_en_ligne?checkout=success`;
  onlineCancelUrl = `${window.location.origin}/front/mes_achats/achat_en_ligne`;

  // Paired product modal state
  showPairedModal = false;
  pendingPairedProduct: Product | null = null;
  pairedSecondMember: Member | null = null;

  buyerForm: FormGroup = new FormGroup({
    buyer: new FormControl(null, Validators.required),
  });


  get buyer() { return this.buyerForm.get('buyer')?.value as Member | null }


  constructor(
    private cartService: CartService,
    private membersService: MembersService,
    private toastService: ToastService,
    private auth: AuthentificationService,
    private route: ActivatedRoute,
    readonly stripeCheckout: StripeCheckoutOrchestrator,
    private shopInit: ShopInitializationService,
    private buyerContext: BuyerContextService,
    private shopProducts: ShopProductService,
  ) {}

  ngOnInit(): void {
    // Override @Input with route data if provided
    const routeOnlineMode = this.route.snapshot.data['onlineMode'];
    if (routeOnlineMode !== undefined) {
      this.onlineMode = routeOnlineMode;
    }

    // Initialize shop session (date, season, operations, permissions)
    this.shopInit.initializeShop().then((state) => {
      this.session = state.session;
      this.operations = state.operations;
      this.canEditPrice = state.canEditPrice;
    });

    // Handle Stripe redirect from Stripe checkout
    if (this.route.snapshot.queryParamMap.get('checkout') === 'success') {
      const sessionId = sessionStorage.getItem('stripe_session_id');
      if (sessionId) {
        this.stripeCheckout.notifyRedirectFromStripe(sessionId);
        sessionStorage.removeItem('stripe_session_id');
      }
    }

    // Load members and setup buyer selection
    this.membersService.listMembers().subscribe((members) => {
      this.members = members;
      this.setupBuyerFromRoute();
    });

    // Watch logged member changes (auth)
    this.auth.logged_member$.subscribe((member) => {
      this.logged_member = member;
      this.handleLoggedMemberChange(member);
    });

    // Watch buyer form changes
    this.buyerForm.valueChanges.subscribe((value) => {
      this.onBuyerChange(value['buyer']);
    });

    // Load and organize products
    this.shopProducts.loadAndOrganizeProducts().subscribe((data) => {
      this.allProducts = data.allProducts;
      this.products_array = data.productsArray;
      // Try to complete Stripe checkout if pending
      this.tryCompleteStripeCheckout();
    });
  }

  /**
   * Configure l'acheteur à partir de la route (member_id @Input ou paramètre)
   */
  private setupBuyerFromRoute(): void {
    if (this.onlineMode) return; // Mode en ligne gère mal l'acheteur par route

    const memberIdFromRoute = this.member_id || this.route.snapshot.paramMap.get('member_id');
    if (!memberIdFromRoute) return;

    const buyer = this.buyerContext.findBuyerById(memberIdFromRoute, this.members);
    if (buyer && this.buyerContext.isValidBuyer(buyer)) {
      this.buyerForm.patchValue({ buyer }, { emitEvent: false });
      this.onBuyerChange(buyer);
    } else {
      console.warn(`ShopComponent: member with id ${memberIdFromRoute} seems invalid`);
      this.buyerForm.patchValue({ buyer: null }, { emitEvent: false });
    }
  }

  /**
   * Gère les changements d'utilisateur connecté
   */
  private handleLoggedMemberChange(member: Member | null): void {
    if (this.onlineMode) {
      this.cartService.setSeller('en ligne');
      if (member && this.members?.length) {
        const m = this.buyerContext.findBuyerById(member.id, this.members);
        if (m) {
          this.buyerForm.patchValue({ buyer: m });
          this.setupBuyerAssets(m);
        }
      }
    } else {
      this.cartService.setSeller(member?.firstname ?? 'unknown');
    }
  }

  /**
   * Configure les avoirs pour un acheteur en mode en ligne
   */
  private async setupBuyerAssets(buyer: Member): Promise<void> {
    const assetAmount = await this.buyerContext.loadAssets(buyer);
    if (assetAmount > 0) {
      this.asset_amount = assetAmount;
      const buyerName = buyer.lastname + ' ' + buyer.firstname;
      this.cartService.setAsset(buyerName, assetAmount);
    }
  }

  /**
   * Vérifie si un retour Stripe est en attente et que toutes les données sont prêtes
   */
  private tryCompleteStripeCheckout(): void {
    // Éviter les appels multiples
    if (this.stripeCheckoutPrepared) return;
    if (!this.logged_member || !this.members?.length || !this.allProducts?.length) return;

    // Abonner une seule fois
    this.stripeCheckout.checkoutState$.pipe(
      filter((s: any) => s.checkoutPhase.phase === 'redirect_pending'),
      filter(() => {
        this.stripeCheckoutPrepared = true;
        return true;
      })
    ).subscribe(async (state: any) => {
      const sessionId = state.checkoutPhase.sessionId;
      if (sessionId) {
        // Préparer le panier via le façade
        const result = await this.stripeCheckout.prepareCheckoutCart(
          sessionId,
          this.logged_member!,
          this.members,
          this.allProducts
        );
        this.debt_amount = result.debtAmount;
        this.asset_amount = result.assetAmount;
        
        // Appeler la façade pour complêter
        this.stripeCheckout.completeCheckout(sessionId, this.session).subscribe(
          () => {}, // La façade gère les états
          (error) => console.error('Erreur completeCheckout Stripe:', error)
        );
      }
    });
  }

  on_product_click(product: Product) {

    if (!this.buyerForm.valid) {
      this.toastService.showWarning('saisie achat', 'selectionner un acheteur');
      return;
    }

    if (product.paired) {
      // Open modal to pick 2nd member before adding to cart
      this.pendingPairedProduct = product;
      this.pairedSecondMember = null;
      this.showPairedModal = true;
    } else {
      const item = this.cartService.build_cart_item(product, this.buyer!);
      this.cartService.addToCart(item);
    }
  }

  on_paired_confirmed() {
    if (!this.pendingPairedProduct || !this.pairedSecondMember) return;
    const item = this.cartService.build_cart_item(
      this.pendingPairedProduct,
      this.buyer!,
      this.pairedSecondMember
    );
    this.cartService.addToCart(item);
    this.showPairedModal = false;
    this.pendingPairedProduct = null;
    this.pairedSecondMember = null;
  }

  on_paired_cancelled() {
    this.showPairedModal = false;
    this.pendingPairedProduct = null;
    this.pairedSecondMember = null;
  }

  cart_confirmed(): void {
    
    let full_name = this.membersService.first_then_last_name(this.buyer!);
    this.isSaving = true;
    this.cartService.save_sale(this.session, this.buyer!)
      .then(() => {
        this.toastService.showSuccess('vente à ' + full_name, (this.debt_amount > 0) ? 'achats et dette enregistrés' : 'achats enregistrés');
      })
      .catch((error) => {
        console.error('error saving sale', error);
        this.toastService.showErrorToast('vente', 'erreur lors de l\'enregistrement de la vente');
      })
      .finally(() => {
        this.buyerForm.reset();
        this.isSaving = false;
      });
  }

  clear_sale(): void {
    this.cartService.clearCart();
    this.buyerForm.reset();
    this.debt_amount = 0;
    this.asset_amount = 0;
  }

  date_change(date: any) {
    this.session.date = new Date(date).toISOString().split('T')[0]; //new Date().toISOString().split('T')[0])
    this.cartService.clearCart();
    this.buyerForm.reset();
  }

  member_name(member_id: string) {
    let member = this.members.find((m) => m.id === member_id);
    return member ? member.lastname + ' ' + member.firstname : '???';
  }


  /**
   * Gère les changements d'acheteur dans le formulaire
   */
  private async onBuyerChange(buyer: Member | null): Promise<void> {
    if (!buyer) {
      this.cartService.clearCart();
      this.debt_amount = 0;
      this.asset_amount = 0;
      this.message = '';
      this.license_paied = false;
      this.membership_paied = false;
      return;
    }

    // Setup buyer context (dettes, avoirs)
    const state = await this.buyerContext.setupBuyer(buyer);
    this.debt_amount = state.debtAmount;
    this.asset_amount = state.assetAmount;

    // Check license status
    this.license_paied = (buyer.license_status === LicenseStatus.DULY_REGISTERED);
    if (!this.license_paied) {
      this.toastService.showWarning('licence', `${buyer.firstname} ${buyer.lastname} n'a pas de licence pour cette saison`);
    }

    // Check membership payment by looking at operations
    const fullName = this.membersService.full_name(buyer);
    this.membership_paied = this.operations
      .filter((op) => op.member === fullName)
      .some((op) => op.values['ADH']);

    if (!this.membership_paied) {
      this.toastService.showWarning('adhésion', `${buyer.firstname} ${buyer.lastname} n'a pas payé l'adhésion au Club`);
    }

    // Generate aggregated message
    this.message = this.buyerContext.determineLicenseMessage(this.license_paied, this.membership_paied);

    // Add asset info if available
    if (this.asset_amount > 0) {
      this.toastService.showInfo('avoir', `cette personne a un avoir de ${this.asset_amount.toFixed(2)} €`);
    }
  }


  product_color_style(product: Product): string {
    return this.shopProducts.getProductColorStyle(product);
  }

  product_gradient_style(product: Product): string {
    return this.shopProducts.getProductGradientStyle(product);
  }

  async on_stripe_checkout(): Promise<void> {
    const member = this.onlineMode ? this.logged_member : this.buyer;
    
    try {
      const result = await this.stripeCheckout.initiateCheckout(
        this.cartService.getCartItems(),
        member || null,
        this.debt_amount,
        this.asset_amount,
        this.session,
        this.onlineMode,
        this.onlineSuccesUrl,
        this.onlineCancelUrl
      );
      window.location.href = result.sessionUrl;
    } catch (error: any) {
      console.error('Stripe checkout error:', error);
    }
  }



  /**
   * Résout l'icône pour un produit
   * Préfère le compte (source de vérité) → fallback sur glyph en DB
   */
  getProductGlyph(product: Product): string {
    return resolveGlyph(product.account, product.glyph);
  }
}
