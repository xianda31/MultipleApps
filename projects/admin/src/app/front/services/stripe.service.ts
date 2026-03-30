import { Injectable } from '@angular/core';
import { post } from 'aws-amplify/api';
import { fetchAuthSession } from 'aws-amplify/auth';
import { StripeCheckoutRequest, StripeCheckoutResponse } from './front-cart.interface';

/**
 * Service Stripe - appelle la Lambda de paiement sécurisée
 * SÉCURITÉ: 
 * - Appel API signé (optionnel si visiteur non authentifié)
 * - Montants validés côté serveur SEULEMENT
 * - Aucune clé Stripe sensitive côté client
 */
@Injectable({
  providedIn: 'root'
})
export class StripeService {
  private readonly API_NAME = 'ffbProxyApi';
  private readonly CHECKOUT_PATH = '/api/stripe/checkout';

  constructor() {}

  /**
   * Crée une session Stripe Checkout
   * @param request Contient seulement les IDs produits (prices vérifiées serveur)
   * @returns SessionId et URL Checkout
   */
  async createCheckoutSession(request: StripeCheckoutRequest): Promise<StripeCheckoutResponse> {
    try {
      // Récupérer la session optionnelle (visiteur peut être non-connecté)
      let headers: Record<string, string> = {};
      try {
        const session = await fetchAuthSession();
        if (session.tokens?.idToken) {
          headers['Authorization'] = `Bearer ${session.tokens.idToken.toString()}`;
        }
      } catch (e) {
        // Visiteur non authentifié, c'est OK pour un achat en ligne
        console.log('Visiteur non authentifié - achat anonyme autorisé');
      }

      const restOperation = post({
        apiName: this.API_NAME,
        path: this.CHECKOUT_PATH,
        options: {
          body: {
            productIds: request.productIds,
            quantities: request.quantities,
            successUrl: request.successUrl,
            cancelUrl: request.cancelUrl,
            customerEmail: request.customerEmail || undefined,
            debtAmountCents: request.debtAmountCents || undefined,
            assetAmountCents: request.assetAmountCents || undefined,
            memberName: request.memberName || undefined,
            buyerMemberId: request.buyerMemberId || undefined,
            cartSnapshot: request.cartSnapshot || undefined,
            season: request.season || undefined,
            date: request.date || undefined,
          } as any,
          headers: {
            'Content-Type': 'application/json',
            ...headers
          }
        }
      });

      const { body } = await restOperation.response;
      const responseText = await body.text();
      const response: StripeCheckoutResponse = JSON.parse(responseText);
 
      if (response.error) {
        throw new Error(response.error);
      }

      return response;
    } catch (error: any) {
      console.error('Erreur création session Stripe:', error);
      throw new Error(`Impossible de créer la session de paiement: ${error?.message || 'Erreur inconnue'}`);
    }
  }

  /**
   * Récupère l'URL du reçu Stripe pour une session donnée
   */
  async getReceiptUrl(sessionId: string): Promise<string | null> {
    try {
      const restOperation = post({
        apiName: this.API_NAME,
        path: '/api/stripe/receipt',
        options: {
          body: { sessionId } as any,
          headers: { 'Content-Type': 'application/json' }
        }
      });

      const { body } = await restOperation.response;
      const responseText = await body.text();
      const response = JSON.parse(responseText);
      return response.data?.receiptUrl || null;
    } catch (error: any) {
      console.error('Erreur récupération reçu Stripe:', error);
      return null;
    }
  }

  /**
   * Récupère le statut d'une session Stripe (optionnel, pour affichage)
   */
  async getSessionStatus(sessionId: string): Promise<any> {
    try {
      const restOperation = post({
        apiName: this.API_NAME,
        path: '/api/stripe/session-status',
        options: {
          body: { sessionId },
          headers: { 'Content-Type': 'application/json' }
        }
      });

      const { body } = await restOperation.response;
      return await body.json();
    } catch (error: any) {
      console.error('Erreur récupération statut session:', error);
      throw error;
    }
  }
}
