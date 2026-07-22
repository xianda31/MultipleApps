import { Injectable } from '@angular/core';
import { get, post } from 'aws-amplify/api';
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

  private async buildAuthenticatedHeaders(extraHeaders: Record<string, string> = {}): Promise<Record<string, string>> {
    const headers: Record<string, string> = { ...extraHeaders };
    const session = await fetchAuthSession();
    if (session.tokens?.idToken) {
      headers['Authorization'] = `Bearer ${session.tokens.idToken.toString()}`;
    }
    return headers;
  }

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
   * Liste les payouts Stripe récents (30 derniers jours)
   */
  async listPayouts(stripeEnvironment: 'test' | 'live' = 'test'): Promise<{
    id: string;
    amountCents: number;
    status: string;
    arrivalDate: string;
    description: string | null;
    automatic: boolean;
  }[]> {
    try {
      const headers = await this.buildAuthenticatedHeaders({ 'X-Stripe-Environment': stripeEnvironment });
      const restOperation = get({
        apiName: this.API_NAME,
        path: '/api/stripe/payout-list',
        options: { headers },
      });
      const { body } = await restOperation.response;
      const responseText = await body.text();
      const response = JSON.parse(responseText);
      if (response.error) throw new Error(response.error);
      return response.payouts || [];
    } catch (error: any) {
      console.error('Erreur listing payouts Stripe:', error);
      throw new Error(`Impossible de lister les payouts: ${error?.message || 'Erreur inconnue'}`);
    }
  }

  /**
   * Récupère un indicateur de santé webhook (fenêtre 7 jours).
   */
  async getWebhookHealth(stripeEnvironment: 'test' | 'live' = 'test'): Promise<{
    windowDays: number;
    totalEvents: number;
    pendingEvents: number;
    deliveredEvents: number;
    stripeEnvironment?: 'test' | 'live';
    status: 'ok' | 'warning';
    events: { id: string; type: string; created: string; pendingWebhooks: number; status: string }[];
  }> {
    try {
      const headers = await this.buildAuthenticatedHeaders({ 'X-Stripe-Environment': stripeEnvironment });

      const restOperation = get({
        apiName: this.API_NAME,
        path: '/api/stripe/webhook-health',
        options: { headers },
      });

      const { body } = await restOperation.response;
      const responseText = await body.text();
      const response = JSON.parse(responseText);
      if (response.error) throw new Error(response.error);
      return response;
    } catch (error: any) {
      console.error('Erreur webhook health Stripe:', error);
      throw new Error(`Impossible de charger la santé webhook: ${error?.message || 'Erreur inconnue'}`);
    }
  }

  /**
   * Lookup payout Stripe : retourne les charges associées à un payout (Admin seulement)
   */
  async lookupPayout(payoutId: string, stripeEnvironment: 'test' | 'live' = 'test'): Promise<{
    payoutId: string;
    stripeEnvironment?: 'test' | 'live';
    isManual?: boolean;
    totalGrossCents: number;
    totalFeesCents: number;
    totalNetCents: number;
    charges: { chargeId: string; stripeTag: string | null; bookEntryId: string | null; grossCents: number; feesCents: number; netCents: number }[];
    refunds?: { refundId: string | null; chargeId: string | null; stripeTag: string | null; bookEntryId: string | null; amountCents: number; feesCents: number; netCents: number; reason: string | null }[];
  }> {
    // Mock dev uniquement
    if (!environment.production && MOCK_PAYOUTS[payoutId]) {
      return MOCK_PAYOUTS[payoutId];
    }
    try {
      const headers = await this.buildAuthenticatedHeaders({
        'Content-Type': 'application/json',
        'X-Stripe-Environment': stripeEnvironment,
      });
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

  /**
   * Récupère les charges Stripe remboursables (non remboursées ou partiellement remboursées)
   */
  async getRefundableCharges(filters?: {
    charge_status?: string;
    payout_status?: string;
    refund_status?: string;
  }) {
    try {
      const headers = await this.buildAuthenticatedHeaders({
        'Content-Type': 'application/json',
      });

      // Construire les query params
      const queryParams = new URLSearchParams();
      if (filters?.charge_status) queryParams.append('charge_status', filters.charge_status);
      if (filters?.payout_status) queryParams.append('payout_status', filters.payout_status);
      if (filters?.refund_status) queryParams.append('refund_status', filters.refund_status);

      const path = '/api/stripe/refundable-charges' + (queryParams.toString() ? '?' + queryParams.toString() : '');

      const restOperation = get({
        apiName: this.API_NAME,
        path,
        options: { headers }
      });
      const { body } = await restOperation.response;
      const responseText = await body.text();
      const response = JSON.parse(responseText);
      
      // response est maintenant { charges: [...], filters: {...}, stripeEnvironment: ... }
      if (!response.charges || !Array.isArray(response.charges)) {
        throw new Error('Invalid response format: expected charges array');
      }
      return response.charges;
    } catch (error: any) {
      console.error('Erreur récupération charges remboursables:', error);
      throw new Error(`Impossible de récupérer les charges: ${error?.message || 'Erreur inconnue'}`);
    }
  }

  /**
   * Crée un remboursement Stripe pour une charge donnée
   */
  async createRefund(data: {
    chargeId: string;
    amountCents: number;
    reason?: string;
    stripeTag?: string;
  }) {
    try {
      const headers = await this.buildAuthenticatedHeaders({
        'Content-Type': 'application/json',
      });
      const restOperation = post({
        apiName: this.API_NAME,
        path: '/api/stripe/refund',
        options: {
          body: data as any,
          headers,
        }
      });
      const { body } = await restOperation.response;
      const responseText = await body.text();
      const response = JSON.parse(responseText);
      if (response.error) throw new Error(response.error);
      return response;
    } catch (error: any) {
      // Essayer d'extraire le message d'erreur du body de la réponse Amplify
      let errorMessage = error?.message || 'Erreur inconnue';
      try {
        const responseBody = await (error as any)?.response?.body?.text?.();
        if (responseBody) {
          const parsed = JSON.parse(responseBody);
          if (parsed.error) errorMessage = parsed.error;
        }
      } catch (_) { /* ignore */ }
      console.error('Erreur création remboursement:', error);
      throw new Error(`Impossible de créer le remboursement: ${errorMessage}`);
    }
  }
}
