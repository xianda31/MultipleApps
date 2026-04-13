/**
 * StripeCheckoutOrchestrator
 * Orchestration centralisée du flux Stripe
 * Encapsule la complexité, expose une API propre au composant
 *
 * Approche BookEntry-first (analogue au chèque) :
 * - La vente est enregistrée AVANT la navigation vers Stripe
 * - En cas de succès : StripeTransaction.processed = true (réconciliation Phase 2)
 * - En cas d'annulation explicite : BookEntry supprimé par le frontend
 * - En cas d'abandon : BookEntry détecté non-réconcilié lors de la Phase 2
 */

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, tap, catchError, of, map } from 'rxjs';
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
  ) {}

  /**
   * Initiate: utilisateur clique "payer"
   *
   * Approche BookEntry-first (analogue au chèque) :
   * 1. Créer session Stripe → obtenir sessionId
   * 2. setStripeTag sur le panier (dérivé du sessionId)
   * 3. save_sale() → BookEntry créé immédiatement
   * 4. Stocker bookEntryId + sessionId en sessionStorage (pour annulation éventuelle)
   * 5. Naviguer vers Stripe
   *
   * En cas d'échec Stripe (cancel_url) : le BookEntry est supprimé par le frontend.
   * En cas d'abandon : BookEntry non réconcilié → détecté en Phase 2 (réconciliation).
   */
  async initiateCheckout(cartItems: CartItem[], member: Member | null, debtAmount: number, assetAmount: number, session: any, onlineMode: boolean, onlineSuccessUrl: string, onlineCancelUrl: string, discountAmountCents?: number): Promise<{ sessionUrl: string }> {
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

    const debtAmountCents = (debtAmount > 0) ? Math.round(debtAmount * 100) : undefined;
    const assetAmountCents = (assetAmount > 0) ? Math.round(assetAmount * 100) : undefined;
    const memberName = member.lastname + ' ' + member.firstname;

    // 2. Créer la session Stripe (validation des prix côté serveur)
    let response;
    try {
      response = await this.stripeService.createCheckoutSession({
        productIds,
        quantities,
        successUrl: onlineSuccessUrl,
        cancelUrl: onlineCancelUrl,
        debtAmountCents,
        assetAmountCents,
        discountAmountCents: (discountAmountCents && discountAmountCents > 0) ? discountAmountCents : undefined,
        memberName,
        buyerMemberId: member.id,
        season: session.season,
        date: session.date,
      });
    } catch (error) {
      this.toastService.showError('Paiement', 'Impossible de créer la session de paiement');
      throw error;
    }

    if (!response.data?.sessionUrl) {
      throw new Error('Pas d\'URL de paiement reçue');
    }

    const sessionId = response.data.sessionId;

    // 3. BookEntry-first : configurer le stripeTag puis sauvegarder la vente
    const stripeTag = getShortStripeTag(sessionId);
    this.cartService.setStripeTag(stripeTag);
    this.cartService.payment = {
      mode: PaymentMode.CARD,
      amount: this.cartService.getCartAmount(),
      payer_id: member.id,
      bank: '',
      cheque_no: '',
    };

    let bookEntry;
    try {
      bookEntry = await this.cartService.save_sale(session);
    } catch (error) {
      this.toastService.showError('Paiement', 'Erreur lors de l\'enregistrement de la vente');
      throw error;
    }

    // 4. Stocker bookEntryId pour annulation (session_id est disponible dans l'URL Stripe au retour)
    sessionStorage.setItem('stripe_book_entry_id', bookEntry.id);

    return { sessionUrl: response.data.sessionUrl };
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
   * Complete: utilisateur revient de Stripe après paiement accepté.
   *
   * BookEntry-first : le BookEntry est DÉJÀ créé en base.
   * On marque simplement la StripeTransaction comme traitée et on affiche le succès.
   * La réconciliation (Phase 2) fera le lien StripeTransaction ↔ BookEntry via stripeTag.
   */
  completeCheckout(sessionId: string, session: any, cartSetupCallback?: () => void): Observable<BookEntry> {
    return new Observable((observer) => {
      this.setState({
        ...this.state$.value,
        checkoutPhase: { phase: 'saving', sessionId },
        isSaving: true,
        error: null,
      });

      // Marquer la transaction comme traitée puis récupérer le reçu
      this.markProcessed(sessionId)
        .pipe(
          tap(() => {
            this.fetchReceipt(sessionId);
            this.setState({
              ...this.state$.value,
              checkoutPhase: { phase: 'success', sessionId },
              isSaving: false,
            });
            // Nettoyer sessionStorage
            sessionStorage.removeItem('stripe_book_entry_id');
          }),
          map(() => ({} as BookEntry)), // BookEntry déjà créé — retourne un objet vide pour compatibilité
          catchError((error) => {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error('[Stripe] Error in completeCheckout:', errorMsg);
            this.setState({
              ...this.state$.value,
              checkoutPhase: { phase: 'error', message: errorMsg },
              isSaving: false,
              error: errorMsg,
            });
            this.toastService.showError('Paiement', `Erreur: ${errorMsg}`);
            observer.error(error);
            return of(null as any);
          })
        )
        .subscribe({
          next: (entry) => { observer.next(entry); observer.complete(); },
          error: (err) => console.error('[Stripe] Subscribe error:', err),
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
   * Annule un checkout en cours : supprime le BookEntry créé en amont (BookEntry-first).
   * Appelé en retour sur cancel_url.
   */
  async cancelPendingCheckout(): Promise<void> {
    const bookEntryId = sessionStorage.getItem('stripe_book_entry_id');
    if (bookEntryId) {
      try {
        await this.dbHandler.deleteBookEntry(bookEntryId);
        console.log(`[Stripe] BookEntry ${bookEntryId} supprimé suite à annulation`);
      } catch (error) {
        console.error('[Stripe] Erreur suppression BookEntry annulé:', error);
        // Non-bloquant — sera détecté à la réconciliation
      }
    }
    sessionStorage.removeItem('stripe_book_entry_id');
    this.reset();
  }

  /**
   * Get current checkout phase
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
