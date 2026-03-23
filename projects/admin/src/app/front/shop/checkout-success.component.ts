import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { Observable, Subject, takeUntil } from 'rxjs';
import { StripeService } from '../services/stripe.service';
import { FrontCartService } from '../services/front-cart.service';

interface CheckoutStatus {
  status: string;
  sessionId?: string;
  amountTotal?: number;
  currency?: string;
  customerEmail?: string;
  paymentStatus?: string;
}

@Component({
  selector: 'app-checkout-success',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './checkout-success.component.html',
  styleUrls: ['./checkout-success.component.scss']
})
export class CheckoutSuccessComponent implements OnInit, OnDestroy {
  sessionId: string | null = null;
  checkoutStatus: CheckoutStatus | null = null;
  isLoading = false;
  error: string | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private stripeService: StripeService,
    private cartService: FrontCartService
  ) {}

  ngOnInit(): void {
    // Récupérer sessionId depuis les query params
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe((params) => {
        this.sessionId = params['session_id'] || null;

        if (this.sessionId) {
          this.fetchCheckoutStatus();
        } else {
          this.error =
            'Identifiant de session manquant. Le paiement peut avoir échoué.';
        }
      });

    // Vider le panier client (le vrai paiement est côté serveur)
    this.cartService.clearCart();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Récupère le statut de la session Stripe
   * ✅ Optionnel: pour afficher les détails de la transaction
   */
  async fetchCheckoutStatus(): Promise<void> {
    if (!this.sessionId) return;

    try {
      this.isLoading = true;
      this.error = null;

      // Appel au service (si la méthode existe)
      // const response = await this.stripeService.getSessionStatus(this.sessionId);
      // this.checkoutStatus = response.data;

      // Pour l'instant, on assume succès si sessionId présent
      this.checkoutStatus = {
        status: 'complete',
        sessionId: this.sessionId,
        paymentStatus: 'paid'
      };
    } catch (error: any) {
      console.error('Erreur récupération status:', error);
      this.error =
        'Impossible de récupérer les détails du paiement. Consultez votre email.';
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Affiche le montant formaté
   */
  formatPrice(centAmount?: number): string {
    if (!centAmount) return '0,00 €';
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(centAmount / 100);
  }
}
