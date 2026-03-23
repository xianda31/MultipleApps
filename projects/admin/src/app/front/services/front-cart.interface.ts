/**
 * Frontend Cart Interface - Simple panier client pour Stripe
 * Indépendant du système de comptabilité du back
 */

import { Product } from '../../back/products/product.interface';

export interface FrontCartItem {
  product: Product;
  quantity: number;
}

export interface FrontCart {
  items: FrontCartItem[];
  subtotal: number; // montant calculé côté client (validé serveur)
}

export interface StripeCheckoutRequest {
  // Les montants sont re-calculés et vérifiés côté serveur
  productIds: string[]; // seulement les IDs, les prices se récupèrent serveur-side
  quantities: number[];
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string; // optionnel, si visiteur connecté
}

export interface StripeCheckoutResponse {
  data: {
    sessionId: string;
    sessionUrl: string; // URL Stripe Checkout
    publishableKey: string; // clé publique Stripe (safe)
  };
  error?: string;
}

export interface StripeWebhookEvent {
  id: string;
  type: string;
  data: {
    object: {
      id: string;
      client_reference_id?: string;
      status?: string;
      payment_status?: string;
      customer_email?: string;
      metadata?: Record<string, string>;
      [key: string]: any;
    };
  };
}
