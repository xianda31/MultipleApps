import { Component, Input } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormGroup, FormControl, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
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
import { StripeTerminalService, TerminalStatus } from './services/stripe-terminal.service';
import { SystemDataService } from '../../common/services/system-data.service';
import { PaymentMode } from './cart/cart.interface';
import { environment } from '../../../environments/environment';

/**
 * ShopComponent — Interface de gestion des ventes (cartes, adhésions, produits)
 *
 * MODES D'OPÉRATION:
 * • onlineMode=true (route: StripeOnlineShop)
 *   - Mode encaisse magasin via Stripe Checkout
 *   - Buyer auto-défini = logged_member (client final)
 *   - Panier temps réel, paiement en ligne
 *   - Webhooks Stripe auto-complètent la transaction
 *
 * • onlineMode=false (route: Shop + query param ?buyerId=xxx)
 *   - Mode vente offline (vendeur présent)
 *   - Buyer sélectionnable via InputMemberComponent
 *   - Buyer peut être pré-sélectionné via buyerId query param
 *   - Paiement: chèque, espèces, tampons, crédit
 *   - Panier manuel, sauvegarde immédiate
 *
 * FONCTIONNALITÉS PRINCIPALES:
 * • Sélection de produits par catégorie (cartes, adhésions, perfectionnement, etc.)
 * • Gestion des payees (paiement effectué par autre membre que buyer)
 * • Support produits paired (2 membres, ex: adhésion couple)
 * • Affichage dette/avoirs du buyer
 * • Panier éditable: quantité, payee, prix si admin/editor
 * • Validation Stripe côté serveur (montants, produits, payees)
 * • Bootstrapping session (date, saison, droits, opérations compta)
 *
 * INTEGRATION:
 * • FeesCollectorComponent redirect vers Shop avec ?buyerId=xxx en offline
 * • QuickSale depuis tournoi → Shop avec buyer pré-sélectionné
 * • Réconciliation Stripe via observables isSuccess$/receiptUrl$
 */

@Component({
  selector: 'app-shop',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, FormsModule, InputMemberComponent, CartComponent,  MoveToEndPipe],
  templateUrl: './shop.component.html',
  styleUrl: './shop.component.scss'
})
export class ShopComponent {
  @Input() member_id: string | null = null;
  @Input() onlineMode !: boolean;
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
  onlinePaymentActive: boolean = true;

  // ── TPE (Stripe Terminal) ──────────────────────────────────
  tpePaymentActive: boolean = false;
  tpePaymentInProgress: boolean = false;
  tpeReaderConnected: boolean = false;
  tpeReaderLabel: string = '';
  tpeStatus: TerminalStatus = 'idle';

  // STRIPE OBSERVABLES (from orchestrator) - as getters to avoid initialization order issues
  get isProcessing$() { return this.stripeCheckout.isProcessing$; }
  get isSuccess$() { return this.stripeCheckout.isSuccess$; }
  get receiptUrl$() { return this.stripeCheckout.receiptUrl$; }
  get shouldShowSpinner$() { return this.stripeCheckout.shouldShowSpinner$; }
  get shouldShowSuccess$() { return this.stripeCheckout.shouldShowSuccess$; }
  // Utilise l'URL courante → fonctionne quelle que soit la route (back test, front menu dynamique, etc.)
  onlineSuccesUrl = `${window.location.origin}${window.location.pathname}?checkout=success`;
  onlineCancelUrl = `${window.location.origin}${window.location.pathname}?checkout=cancel`;

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
    private router: Router,
    readonly stripeCheckout: StripeCheckoutOrchestrator,
    private shopInit: ShopInitializationService,
    private buyerContext: BuyerContextService,
    private shopProducts: ShopProductService,
    private systemDataService: SystemDataService,
    private stripeTerminal: StripeTerminalService,
  ) {}

  ngOnInit(): void {
    // Apply default for @Input (not auto-applied by Angular)
    this.onlineMode ??= true;

    if (this.onlineMode) {
      this.systemDataService.get_configuration().subscribe(conf => {
        this.onlinePaymentActive = conf.online_payment_active ?? true;
      });
    } else {
      this.systemDataService.get_configuration().subscribe(conf => {
        this.tpePaymentActive = conf.tpe_payment_active ?? false;
      });
    }

    const routeOnlineMode = this.route.snapshot.data['onlineMode'];
    if (routeOnlineMode !== undefined) {
      this.onlineMode = routeOnlineMode;
    }

    // Initialize shop session (date, season, operations, permissions)
    this.shopInit.initializeShop().then((state) => {
      this.session = state.session;
      this.operations = state.operations;
      this.canEditPrice = state.canEditPrice;

      // initializeShop() a déjà chargé les book_entries via loadOperations()
      // -> pas besoin d'un deuxième appel list_book_entries()

      // Handle Stripe redirect from Stripe checkout
      const checkoutResult = this.route.snapshot.queryParamMap.get('checkout');
      if (checkoutResult === 'success') {
        // session_id est injecté par Stripe directement dans l'URL de retour
        const sessionId = this.route.snapshot.queryParamMap.get('session_id');
        if (sessionId) {
          this.stripeCheckout.notifyRedirectFromStripe(sessionId);
        }
      } else if (checkoutResult === 'cancel') {
        // BookEntry-first : annulation explicite → supprimer le BookEntry créé
        this.stripeCheckout.cancelPendingCheckout().then(() => {
          this.toastService.showWarning('Paiement', 'Paiement annulé');
        });
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
    });
  }

  /**
   * Configure l'acheteur à partir de la route (member_id @Input ou paramètre, ou buyerId query param)
   */
  private setupBuyerFromRoute(): void {
    if (this.onlineMode) {
      // En mode en ligne : si l'auth a été résolue avant le chargement des membres,
      // handleLoggedMemberChange a sauté le patchValue (this.members était vide).
      // On relance ici maintenant que les membres sont disponibles.
      if (this.logged_member) {
        this.handleLoggedMemberChange(this.logged_member);
      }
      return;
    }

    // Essayer en priorité le query param buyerId (plus fiable que path param)
    // Puis fallback sur path param member_id ou @Input member_id
    const buyerIdFromQuery = this.route.snapshot.queryParamMap.get('buyerId');
    const memberIdFromRoute = buyerIdFromQuery || this.member_id || this.route.snapshot.paramMap.get('member_id');
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
      // En mode retour Stripe (BookEntry-first), le panier est déjà sauvegardé — on ne le recharge pas.
      // En mode normal, on configure l'acheteur seulement si pas encore fait (!this.buyer).
      const isStripeReturnMode = this.stripeCheckout.getCurrentPhase() !== 'idle';
      if (!isStripeReturnMode && member && this.members?.length && !this.buyer) {
        const m = this.buyerContext.findBuyerById(member.id, this.members);
        if (m) {
          this.buyerForm.patchValue({ buyer: m });
          this.setupBuyerAssets(m);
        }
      }
      // Toujours tenter de compléter le checkout Stripe si en attente
      this.tryCompleteStripeCheckout();
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
    if (!this.logged_member) return;

    // Check if we're in redirect_pending state (redirect from Stripe)
    const sessionId = this.stripeCheckout.getPendingSessionId();
    if (!sessionId) return;

    this.stripeCheckoutPrepared = true;
    console.log('[Shop] Stripe retour détecté, sessionId:', sessionId);

    // BookEntry-first : le BookEntry est déjà créé, on marque juste processed
    this.stripeCheckout.completeCheckout(sessionId, this.session).subscribe({
      next: () => console.log('[Shop] completeCheckout next'),
      error: (error) => console.error('[Shop] completeCheckout error:', error),
      complete: () => console.log('[Shop] completeCheckout complete'),
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
        this.toastService.showError('vente', 'erreur lors de l\'enregistrement de la vente');
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

  dismissSuccessBanner(): void {
    this.stripeCheckout.reset();
    this.stripeCheckoutPrepared = false;
    this.cartService.clearCart();
    // En mode online, re-établir l'acheteur (logged_member) immédiatement
    // pour permettre un nouvel achat sans attendre le cycle async auth/members
    if (this.onlineMode && this.logged_member) {
      const m = this.buyerContext.findBuyerById(this.logged_member.id, this.members);
      if (m) {
        this.buyerForm.patchValue({ buyer: m }, { emitEvent: false });
      }
    }
    this.router.navigate([], { relativeTo: this.route, queryParams: {} });
  }

  async on_stripe_checkout(): Promise<void> {
    const member = this.onlineMode ? this.logged_member : this.buyer;
    const cartItems = this.cartService.getCartItems();

    // Calculer la ristourne globale (mode offline uniquement)
    // = différence entre prix DB et prix saisis dans le cart
    let discountAmountCents: number | undefined;
    if (!this.onlineMode) {
      let totalDiscountCents = 0;
      for (const item of cartItems) {
        const product = this.allProducts.find(p => p.id === item.product_id);
        if (product) {
          const discountCents = Math.round((product.price - item.paied) * 100);
          if (discountCents > 0) totalDiscountCents += discountCents;
        }
      }
      if (totalDiscountCents > 0) discountAmountCents = totalDiscountCents;
    }

    try {
      const result = await this.stripeCheckout.initiateCheckout(
        cartItems,
        member || null,
        this.debt_amount,
        this.asset_amount,
        this.session,
        this.onlineMode,
        this.onlineSuccesUrl,
        this.onlineCancelUrl,
        discountAmountCents
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

  // ── TPE (Stripe Terminal) ──────────────────────────────────

  /**
   * Découvre et connecte le premier reader Bluetooth disponible.
   * En dev/sandbox : utilise le simulateur Stripe (simulated=true).
   */
  async onConnectReader(): Promise<void> {
    try {
      const simulated = environment.tpe_simulated;
      const readers = await this.stripeTerminal.discoverReaders(simulated);

      if (readers.length === 0) {
        this.toastService.showWarning('TPE', 'Aucun reader trouvé. Vérifiez le Bluetooth et l\'appairage.');
        return;
      }

      // Connecter automatiquement le premier reader trouvé
      await this.stripeTerminal.connectReader(readers[0]);
      this.tpeReaderConnected = true;
      this.tpeReaderLabel = readers[0].label || readers[0].id || 'WisePad 3';
      this.tpeStatus = 'connected';
      this.toastService.showSuccess('TPE', `Reader connecté : ${this.tpeReaderLabel}`);

      // Suivre les changements d'état
      this.stripeTerminal.status$.subscribe(status => {
        this.tpeStatus = status;
        if (status === 'disconnected') {
          this.tpeReaderConnected = false;
          this.tpeReaderLabel = '';
          this.toastService.showWarning('TPE', 'Reader déconnecté.');
        }
      });
    } catch (err: any) {
      this.toastService.showError('TPE', err.message || 'Erreur de connexion au reader');
    }
  }

  /**
   * Déconnecte le reader Bluetooth.
   */
  async onDisconnectReader(): Promise<void> {
    try {
      await this.stripeTerminal.disconnectReader();
      this.tpeReaderConnected = false;
      this.tpeReaderLabel = '';
      this.tpeStatus = 'idle';
      this.toastService.showSuccess('TPE', 'Reader déconnecté.');
    } catch (err: any) {
      this.toastService.showError('TPE', err.message || 'Erreur lors de la déconnexion');
    }
  }

  /**
   * Déclenche le flux de paiement TPE :
   * 1. Crée le PaymentIntent côté serveur
   * 2. SDK collecte la carte via le WisePad 3
   * 3. SDK traite le paiement
   * 4. Enregistre la vente (BookEntry)
   * Le webhook payment_intent.succeeded enregistre la StripeTransaction en parallèle.
   */
  async onPayByCard(): Promise<void> {
    if (!this.buyer) {
      this.toastService.showWarning('TPE', 'Sélectionner un acheteur');
      return;
    }

    const amountCents = Math.round(this.cartService.getCartAmount() * 100);
    if (amountCents <= 0) {
      this.toastService.showWarning('TPE', 'Montant invalide (≤ 0)');
      return;
    }

    this.tpePaymentInProgress = true;

    try {
      const memberName = this.buyer.lastname + ' ' + this.buyer.firstname;

      // 1. Créer le PaymentIntent côté serveur (validation prix + metadata)
      const { clientSecret, stripeTag } = await this.stripeTerminal.createPaymentIntent({
        amountCents,
        memberName,
        buyerMemberId: this.buyer.id,
        season: this.session.season,
        date: this.session.date,
      });

      // 2. Stocker le stripeTag dans le panier pour traçabilité BookEntry
      this.cartService.setStripeTag(stripeTag);

      // 3. Présenter la carte sur le TPE et traiter le paiement
      await this.stripeTerminal.collectAndProcess(clientSecret);

      // 4. Paiement accepté → enregistrer la vente avec mode CARTE
      this.cartService.payment = {
        amount: this.cartService.getCartAmount(),
        payer_id: this.buyer.id,
        mode: PaymentMode.CARD,
        bank: '',
        cheque_no: '',
      };
      this.cart_confirmed();
      this.toastService.showSuccess('Paiement CB', 'Carte acceptée — vente enregistrée');
    } catch (err: any) {
      this.toastService.showError('Paiement CB', err.message || 'Erreur paiement TPE');
      this.stripeTerminal.resetStatus();
    } finally {
      this.tpePaymentInProgress = false;
    }
  }
}
