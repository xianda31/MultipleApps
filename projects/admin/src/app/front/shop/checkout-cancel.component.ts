import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subject } from 'rxjs';
import { FrontCartService } from '../services/front-cart.service';
import { StripeCheckoutOrchestrator } from '../../back/shop/stripe-checkout/stripe-checkout.orchestrator';

@Component({
  selector: 'app-checkout-cancel',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './checkout-cancel.component.html',
  styleUrls: ['./checkout-cancel.component.scss']
})
export class CheckoutCancelComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  isCleaning = false;

  constructor(
    private cartService: FrontCartService,
    private stripeCheckout: StripeCheckoutOrchestrator
  ) {}

  async ngOnInit(): Promise<void> {
    // Le panier reste intact pour permettre à l'utilisateur de réessayer
    // (contrairement au succès où on le vide)
    console.log('Utilisateur a annulé le paiement');

    // Supprimer le BookEntry précréé via l'orchestrateur
    this.isCleaning = true;
    try {
      await this.stripeCheckout.cancelPendingCheckout();
      console.log('[Checkout Cancel] BookEntry cleanup completed');
    } catch (error) {
      console.error('[Checkout Cancel] BookEntry cleanup failed:', error);
      // Non-bloquant - l'admin nettoiera via la réconciliation au besoin
    } finally {
      this.isCleaning = false;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
