import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable, Subject, takeUntil } from 'rxjs';
import { ToastService } from '../../common/services/toast.service';
import { StripeProductService } from '../../common/services/stripe-product.service';
import { FrontCartService } from '../services/front-cart.service';
import { StripeService } from '../services/stripe.service';
import { StripeProduct } from '../../back/products/stripe-product.interface';
import { StripeCart } from '../services/stripe-cart.interface';

@Component({
  selector: 'app-front-shop',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './front-shop.component.html',
  styleUrls: ['./front-shop.component.scss']
})
export class FrontShopComponent implements OnInit, OnDestroy {
  products$!: Observable<StripeProduct[]>;
  cart$!: Observable<StripeCart>;
  
  isCheckingOut = false;
  showCart = false;
  
  private destroy$ = new Subject<void>();

  constructor(
    private stripeProductService: StripeProductService,
    private cartService: FrontCartService,
    private stripeService: StripeService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    // Charger les produits Stripe disponibles à l'achat
    this.products$ = this.stripeProductService.listStripeProducts();
    
    // Observer le panier
    this.cart$ = this.cartService.cart$;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Ajoute un produit au panier
   */
  addToCart(product: StripeProduct): void {
    this.cartService.addToCart(product, 1);
    this.toastService.showSuccess(
      `${product.name} ajouté au panier`,
      'Produit ajouté'
    );
  }

  /**
   * Retire un item du panier
   */
  removeFromCart(productId: string): void {
    this.cartService.removeFromCart(productId);
  }

  /**
   * Met à jour la quantité
   */
  updateQuantity(productId: string, quantity: number): void {
    this.cartService.updateQuantity(productId, quantity);
  }

  /**
   * Lance le checkout Stripe
   * 🔒 SÉCURITÉ: Les montants seront vérifiés côté serveur
   */
  async checkout(): Promise<void> {
    try {
      const cart = this.cartService.cart;

      // Vérifier que le panier n'est pas vide
      if (!cart.items || cart.items.length === 0) {
        this.toastService.showWarning('Votre panier est vide', 'Erreur');
        return;
      }

      // Vérifier le minimum Stripe (0,50€ = 50 centimes)
      if (cart.subtotal < 0.50) {
        this.toastService.showWarning(
          'Le montant minimum est de 0,50€ par commande (limite Stripe)',
          'Montant insuffisant'
        );
        return;
      }

      this.isCheckingOut = true;

      // Préparer la requête (seulement IDs + quantités)
      const { productIds, quantities } = this.cartService.getCheckoutPayload();

      // Créer la session Stripe (IDs validés + montants recalculés serveur)
      const response = await this.stripeService.createCheckoutSession({
        productIds,
        quantities,
        successUrl: `${window.location.origin}/front/checkout-success`,
        cancelUrl: `${window.location.origin}/front/shop`,
        customerEmail: undefined // TODO: optionnel si connecté
      });

      // Rediriger vers Stripe Checkout
      if (response.data?.sessionUrl) {
        window.location.href = response.data.sessionUrl;
      } else {
        throw new Error('Pas d\'URL de paiement reçue');
      }
    } catch (error: any) {
      console.error('Erreur checkout:', error);
      this.toastService.showErrorToast(
        'Impossible de créer la session de paiement',
        error?.message || 'Erreur inconnue'
      );
    } finally {
      this.isCheckingOut = false;
    }
  }

  /**
   * Vide le panier
   */
  clearCart(): void {
    this.cartService.clearCart();
    this.toastService.showInfo('Panier vidé', 'Info');
  }

  /**
   * Utilitaire: formater le prix
   */
  formatPrice(price: number): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(price);
  }
}
