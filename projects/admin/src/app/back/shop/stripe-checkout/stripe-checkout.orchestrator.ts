/**
 * StripeCheckoutOrchestrator
 * Orchestration centralisée du flux Stripe
 * Encapsule la complexité, expose une API propre au composant
 */

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, tap, switchMap, catchError, of, map } from 'rxjs';
import { CartService } from '../cart/cart.service';
import { StripeService } from '../../../front/services/stripe.service';
import { DBhandler } from '../../../common/services/graphQL.service';
import { 
  StripeCheckoutState, 
  initialCheckoutState, 
  checkoutSelectors 
} from './stripe-checkout.state';
import { BookEntry } from '../../../common/interfaces/accounting.interface';
import { Member } from '../../../common/interfaces/member.interface';
import { getShortStripeTag } from '../../../common/utilities/stripe-utils';
import { ToastService } from '../../../common/services/toast.service';
import { CartItem, PaymentMode } from '../cart/cart.interface';
import { Product } from '../../products/product.interface';
import { BuyerContextService } from '../services/buyer-context.service';
import { MembersService } from '../../../common/services/members.service';

const STRIPE_CART_KEY = 'stripe_pending_cart';

@Injectable({
  providedIn: 'root'
})
export class StripeCheckoutOrchestrator {
  
  private state$ = new BehaviorSubject<StripeCheckoutState>(initialCheckoutState);
  
  // Observables publiques (consommées par les composants) - SIMPLIFIÉ
  readonly checkoutState$ = this.state$.asObservable();
  readonly isProcessing$ = this.checkoutState$.pipe(
    map(s => checkoutSelectors.isProcessing(s))
  );
  readonly isSuccess$ = this.checkoutState$.pipe(
    map(s => checkoutSelectors.isSuccess(s))
  );
  readonly receiptUrl$ = this.checkoutState$.pipe(
    map(s => checkoutSelectors.receiptUrl(s))
  );
  readonly shouldShowSpinner$ = this.checkoutState$.pipe(
    map(s => checkoutSelectors.shouldShowSpinner(s))
  );
  readonly shouldShowSuccess$ = this.checkoutState$.pipe(
    map(s => checkoutSelectors.shouldShowSuccess(s))
  );

  constructor(
    private cartService: CartService,
    private stripeService: StripeService,
    private dbHandler: DBhandler,
    private toastService: ToastService,
    private buyerContext: BuyerContextService,
    private membersService: MembersService,
  ) {
    // Note: Auto-complete est géré par le composant qui appelle completeCheckout()
    // après avoir préparé les données du panier
  }

  /**
   * Initiate: utilisateur clique "payer", crée session Stripe
   * Gère la préparation de la session et la sauvegarde du snapshot
   */
  initiateCheckout(cartItems: CartItem[], member: Member | null, debtAmount: number, assetAmount: number, session: any, onlineMode: boolean, onlineSuccessUrl: string, onlineCancelUrl: string, discountAmountCents?: number): Promise<{ sessionUrl: string }> {
    return new Promise((resolve, reject) => {
      try {
        if (!member) {
          throw new Error('Aucun acheteur sélectionné');
        }

        // 1. Grouper les produits par ID
        const productGroup = new Map<string, number>();
        for (const item of cartItems) {
          productGroup.set(item.product_id, (productGroup.get(item.product_id) || 0) + 1);
        }
        const productIds = [...productGroup.keys()];
        const quantities = productIds.map(id => productGroup.get(id)!);

        // 2. Préparer les montants
        const debtAmountCents = (debtAmount > 0) ? Math.round(debtAmount * 100) : undefined;
        const assetAmountCents = (assetAmount > 0) ? Math.round(assetAmount * 100) : undefined;
        const memberName = member.lastname + ' ' + member.firstname;

        // 3. Créer le snapshot du panier
        const snapshot = cartItems.map(item => ({
          productId: item.product_id,
          payeeId: item.payee?.id,
          pairedMemberId: item.paired_with?.id,
        }));

        // 4. Créer la session Stripe
        this.stripeService.createCheckoutSession({
          productIds,
          quantities,
          successUrl: onlineSuccessUrl,
          cancelUrl: onlineCancelUrl,
          debtAmountCents,
          assetAmountCents,
          discountAmountCents: (discountAmountCents && discountAmountCents > 0) ? discountAmountCents : undefined,
          memberName,
          buyerMemberId: member.id,
          cartSnapshot: snapshot,
          season: session.season,
          date: session.date,
        }).then((response) => {
          if (!response.data?.sessionUrl) {
            throw new Error('Pas d\'URL de paiement reçue');
          }

          // 5. Sauvegarder le snapshot ET le sessionId en sessionStorage pour le retour
          const STRIPE_CART_KEY = 'stripe_pending_cart';
          sessionStorage.setItem(STRIPE_CART_KEY, JSON.stringify({
            snapshot,
            sessionId: response.data.sessionId,
          }));
          // Sauvegarder aussi le sessionId seul pour un accès facile au retour
          sessionStorage.setItem('stripe_session_id', response.data.sessionId);

          resolve({ sessionUrl: response.data.sessionUrl });
        }).catch((error) => {
          this.toastService.showErrorToast('Paiement', 'Impossible de créer la session de paiement');
          reject(error);
        });
      } catch (error) {
        this.toastService.showErrorToast('Paiement', error instanceof Error ? error.message : 'Erreur lors de l\'initiation du paiement');
        reject(error);
      }
    });
  }

  /**
   * Notify: retour de Stripe, marquer que nous sommes en attente de complétude
   */
  notifyRedirectFromStripe(sessionId: string): void {
    this.setState({
      ...this.state$.value,
      checkoutPhase: { phase: 'redirect_pending', sessionId },
    });
  }

  /**
   * Complete: Utilisateur revient de Stripe, sauvegarde tout
   * @param sessionId ID de la session Stripe
   * @param session Objet session (date, season) pour l'enregistrement
   * @param cartSetupCallback Fonction optionnelle pour configurer le panier (récupérer depuis sessionStorage, etc)
   */
  completeCheckout(sessionId: string, session: any, cartSetupCallback?: () => void): Observable<BookEntry> {
    return new Observable((observer) => {
      this.setState({
        ...this.state$.value,
        checkoutPhase: { phase: 'saving', sessionId },
        isSaving: true,
        error: null,
      });

      try {
        // Laisser le composant configurer le panier si une callback est fournie
        if (cartSetupCallback) {
          cartSetupCallback();
        }

        // Orchestrez tout: save_sale -> mark processed -> get receipt
        this.saveCheckoutEntry(sessionId, session)
          .pipe(
            switchMap((entry) => 
              this.markProcessed(sessionId).pipe(
                tap(() => {
                  console.log('[Stripe] Transaction marked as processed');
                  this.fetchReceipt(sessionId);
                }),
                map(() => entry)
              )
            ),
            tap((entry) => {
              console.log('[Stripe] Checkout complete, setting state to success');
              this.setState({
                ...this.state$.value,
                checkoutPhase: { 
                  phase: 'success', 
                  sessionId,
                },
                isSaving: false,
              });
              observer.next(entry);
              observer.complete();
            }),
            catchError((error) => {
              const errorMsg = error instanceof Error ? error.message : String(error);
              console.error('[Stripe] Error in complete checkout:', errorMsg);
              this.setState({
                ...this.state$.value,
                checkoutPhase: { phase: 'error', message: errorMsg },
                isSaving: false,
                error: errorMsg,
              });
              this.toastService.showErrorToast('Paiement', `Erreur: ${errorMsg}`);
              observer.error(error);
              return of(null);
            })
          )
          .subscribe({
            next: () => {},
            error: (err) => console.error('[Stripe] Subscribe error:', err),
            complete: () => console.log('[Stripe] Complete checkout observable completed')
          });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error('[Stripe] Exception in completeCheckout:', errorMsg);
        this.setState({
          ...this.state$.value,
          checkoutPhase: { phase: 'error', message: errorMsg },
          isSaving: false,
          error: errorMsg,
        });
        observer.error(error);
      }
    });
  }

  /**
   * Sauvegarde l'entrée comptable (BookEntry)
   */
  private saveCheckoutEntry(sessionId: string, session: any): Observable<BookEntry> {
    return new Observable((observer) => {
      // Utilise cartService pour sauvegarder (cartService doit avoir le panier configuré)
      const stripeTag = getShortStripeTag(sessionId);
      this.cartService.setStripeTag(stripeTag);

      this.cartService.save_sale(session)
        .then((entry) => {
          observer.next(entry);
          observer.complete();
        })
        .catch((error) => {
          observer.error(error);
        });
    });
  }

  /**
   * Marque la transaction comme traitée
   */
  private markProcessed(sessionId: string): Observable<void> {
    return new Observable((observer) => {
      this.dbHandler.markStripeTransactionProcessed(sessionId)
        .then(() => {
          observer.next();
          observer.complete();
        })
        .catch((error) => {
          console.error('Error marking stripe transaction processed:', error);
          observer.next(); // Non-bloquant
          observer.complete();
        });
    });
  }

  /**
   * Récupère le reçu Stripe (fire & forget)
   */
  private fetchReceipt(sessionId: string): void {
    this.stripeService.getReceiptUrl(sessionId)
      .then((url) => {
        if (url) {
          this.setState({
            ...this.state$.value,
            checkoutPhase: { 
              phase: 'success', 
              sessionId,
              receiptUrl: url,
            },
          });
        }
      })
      .catch((error) => {
        console.error('Error fetching receipt:', error);
        // Non-bloquant
      });
  }

  /**
   * Prépare/restaure le panier Stripe après un retour de Stripe
   * Reconstruit le panier depuis le sessionStorage avec les données sauvegardées
   */
  async prepareCheckoutCart(
    sessionId: string,
    loggedMember: Member,
    members: Member[],
    allProducts: Product[]
  ): Promise<{ debtAmount: number; assetAmount: number }> {
    const raw = sessionStorage.getItem(STRIPE_CART_KEY);
    if (!raw) {
      console.warn('No Stripe cart found in sessionStorage');
      return { debtAmount: 0, assetAmount: 0 };
    }

    try {
      const stored: { snapshot: Array<{ productId: string; payeeId?: string; pairedMemberId?: string }>; sessionId?: string } = JSON.parse(raw);
      const snapshot = stored.snapshot;

      // Vérifier que toutes les données sont chargées
      if (!loggedMember || !members?.length || !allProducts?.length) {
        console.warn('Missing data for Stripe cart restoration:', { loggedMember: !!loggedMember, members: members?.length, products: allProducts?.length });
        return { debtAmount: 0, assetAmount: 0 };
      }

      const buyer = members.find(m => m.id === loggedMember.id);
      if (!buyer) {
        console.warn('Buyer not found for Stripe cart restoration');
        return { debtAmount: 0, assetAmount: 0 };
      }

      // Reconstruire le panier
      this.cartService.clearCart();
      this.cartService.setBuyer(buyer.lastname + ' ' + buyer.firstname);

      for (const item of snapshot) {
        const product = allProducts.find(p => p.id === item.productId);
        if (!product) continue;
        const payee = item.payeeId ? (members.find(m => m.id === item.payeeId) ?? buyer) : buyer;
        let paired: Member | undefined;
        if (item.pairedMemberId) {
          paired = members.find(m => m.id === item.pairedMemberId);
        }
        const cartItem = this.cartService.build_cart_item(product, payee, paired);
        this.cartService.addToCart(cartItem);
      }

      // Recalculer dette et avoir avec le service
      const debtAmount = await this.buyerContext.loadDebt(buyer);
      if (debtAmount > 0) {
        this.cartService.setDebt(buyer.lastname + ' ' + buyer.firstname, debtAmount);
      }

      const assetAmount = await this.buyerContext.loadAssets(buyer);
      if (assetAmount > 0) {
        this.cartService.setAsset(buyer.lastname + ' ' + buyer.firstname, assetAmount);
      }

      // Payment mode = virement bancaire (Stripe)
      this.cartService.payment = {
        mode: PaymentMode.TRANSFER,
        amount: this.cartService.getCartAmount(),
        payer_id: buyer.id,
        bank: '',
        cheque_no: '',
      };

      // Tag pour traçabilité
      this.cartService.setStripeTag(getShortStripeTag(sessionId));

      // Nettoyer sessionStorage
      sessionStorage.removeItem(STRIPE_CART_KEY);

      return { debtAmount, assetAmount };
    } catch (error) {
      console.error('Error preparing Stripe cart:', error);
      this.toastService.showErrorToast('Paiement', 'Erreur lors de la préparation du panier');
      return { debtAmount: 0, assetAmount: 0 };
    }
  }

  /**
   * Get current checkout phase - allows components to check state immediately without subscription timing issues
   */
  getCurrentPhase(): string {
    return this.state$.value.checkoutPhase.phase;
  }

  /**
   * Get pending session ID if checkout is in redirect_pending state
   */
  getPendingSessionId(): string | null {
    if (this.state$.value.checkoutPhase.phase === 'redirect_pending') {
      return this.state$.value.checkoutPhase.sessionId;
    }
    return null;
  }

  /**
   * Réinitialise l'état
   */
  reset(): void {
    this.setState(initialCheckoutState);
  }

  /**
   * State management interne
   */
  private setState(newState: StripeCheckoutState): void {
    this.state$.next(newState);
  }
}
