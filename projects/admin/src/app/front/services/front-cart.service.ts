import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { StripeProduct } from '../../back/products/stripe-product.interface';
import { StripeCart, StripeCartItem } from './stripe-cart.interface';

/**
 * Service de panier frontend - SIMPLE, pas de logique métier complexe
 * La sécurité est entièrement côté serveur (Lambda)
 * Ce service fait juste la gestion UI du panier
 */
@Injectable({
  providedIn: 'root'
})
export class FrontCartService {
  private _cart: StripeCart = { items: [], subtotal: 0 };
  private _cart$ = new BehaviorSubject<StripeCart>(this._cart);

  constructor() {}

  get cart$(): Observable<StripeCart> {
    return this._cart$.asObservable();
  }

  get cart(): StripeCart {
    return this._cart;
  }

  /**
   * Ajoute un produit au panier (ou augmente la quantité)
   * IMPORTANT: Aucune validation du prix ici - sera fait serveur-side
   */
  addToCart(product: StripeProduct, quantity: number = 1): void {
    const existingItem = this._cart.items.find(item => item.product.id === product.id);
    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      this._cart.items.push({ product, quantity });
    }
    this._updateSubtotal();
  }

  /**
   * Retire un item du panier
   */
  removeFromCart(productId: string): void {
    this._cart.items = this._cart.items.filter(item => item.product.id !== productId);
    this._updateSubtotal();
  }

  /**
   * Met à jour la quantité d'un item
   */
  updateQuantity(productId: string, quantity: number): void {
    const item = this._cart.items.find(i => i.product.id === productId);
    if (item) {
      if (quantity <= 0) {
        this.removeFromCart(productId);
      } else {
        item.quantity = quantity;
        this._updateSubtotal();
      }
    }
  }

  /**
   * Vide le panier
   */
  clearCart(): void {
    this._cart = { items: [], subtotal: 0 };
    this._cart$.next(this._cart);
  }

  /**
   * Calcul du sous-total (affichage SEULEMENT)
   * CE MONTANT NE SERA PAS UTILISÉ POUR LE PAIEMENT
   * Stripe utilisera les montants vérifiés côté serveur
   */
  private _updateSubtotal(): void {
    this._cart.subtotal = this._cart.items.reduce(
      (total, item) => total + (item.product.amount * item.quantity),
      0
    );
    this._cart$.next(this._cart);
  }

  /**
   * Retourne les IDs de produits pour Stripe
   * Utilisé uniquement pour identifier les produits auprès du serveur
   */
  getCheckoutPayload(): { productIds: string[]; quantities: number[] } {
    return {
      productIds: this._cart.items.map(item => item.product.id),
      quantities: this._cart.items.map(item => item.quantity)
    };
  }
}
