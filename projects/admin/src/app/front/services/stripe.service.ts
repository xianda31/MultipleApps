import { Injectable } from '@angular/core';
import { post } from 'aws-amplify/api';
import { fetchAuthSession } from 'aws-amplify/auth';
import { StripeCheckoutRequest, StripeCheckoutResponse } from './front-cart.interface';
import { environment } from '../../../environments/environment';

// Mocks dev uniquement — jamais utilisés en production
const MOCK_PAYOUTS: Record<string, any> = {
  'po_mock_renoux_65': {
    payoutId: 'po_mock_renoux_65',
    totalGrossCents: 6500,
    totalFeesCents: 236,
    totalNetCents: 6264,
    charges: [{
      chargeId: 'ch_test_G49XYpmnzyJu',
      stripeTag: 'stripe:G49XYpmnzyJu',
      bookEntryId: 'e3322d9d-82f8-4455-9d0a-13903f3990d8',
      grossCents: 6500,
      feesCents: 236,
      netCents: 6264,
    }],
  },
};

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
            discountAmountCents: request.discountAmountCents || undefined,
            memberName: request.memberName || undefined,
            buyerMemberId: request.buyerMemberId || undefined,
            bookEntryId: request.bookEntryId || undefined,
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
   * Lookup payout Stripe : retourne les charges associées à un payout (Admin seulement)
   */
  async lookupPayout(payoutId: string): Promise<{
    payoutId: string;
    totalGrossCents: number;
    totalFeesCents: number;
    totalNetCents: number;
    charges: { chargeId: string; stripeTag: string | null; bookEntryId: string | null; grossCents: number; feesCents: number; netCents: number }[];
  }> {
    // Mock dev uniquement
    if (!environment.production && MOCK_PAYOUTS[payoutId]) {
      return MOCK_PAYOUTS[payoutId];
    }
    try {
      const session = await fetchAuthSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session.tokens?.idToken) {
        headers['Authorization'] = `Bearer ${session.tokens.idToken.toString()}`;
      }
      const restOperation = post({
        apiName: this.API_NAME,
        path: '/api/stripe/payout-lookup',
        options: {
          body: { payoutId } as any,
          headers,
        }
      });
      const { body } = await restOperation.response;
      const responseText = await body.text();
      const response = JSON.parse(responseText);
      if (response.error) throw new Error(response.error);
      return response;
    } catch (error: any) {
      console.error('Erreur lookup payout Stripe:', error);
      throw new Error(`Impossible de récupérer le payout: ${error?.message || 'Erreur inconnue'}`);
    }
  }
}
