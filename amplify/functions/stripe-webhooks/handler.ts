/**
 * Lambda Stripe Webhooks Handler
 * ⚠️ SÉCURITÉ CRITIQUE ⚠️
 * 
 * Reçoit et valide les événements Stripe
 * Enregistre les transactions de paiement
 */

import Stripe from 'stripe';
import { generateClient } from 'aws-amplify/api';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-04-10' as any,
});

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

interface StripeTransaction {
  id?: string;
  stripeSessionId: string;
  stripeMeta?: Record<string, string>;
  status: 'pending' | 'completed' | 'failed';
  amountCents: number; // en centimes
  currency: string;
  customerEmail?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Valide la signature du webhook Stripe
 * ESSENTIEL pour vérifier que c'est vraiment Stripe qui envoie
 */
function validateWebhookSignature(body: string, signature: string): any {
  try {
    if (!WEBHOOK_SECRET) {
      throw new Error('STRIPE_WEBHOOK_SECRET not configured');
    }

    const event = stripe.webhooks.constructEvent(body, signature, WEBHOOK_SECRET);
    return event;
  } catch (error: any) {
    throw new Error(`Webhook signature validation failed: ${error.message}`);
  }
}

/**
 * Enregistre une transaction de paiement validée dans la DB
 */
async function recordStripeTransaction(transaction: StripeTransaction): Promise<void> {
  try {
    const dbHandler = generateClient();

    // Vérifier si la transaction existe déjà (idempotence)
    const { data: existing } = await dbHandler.models.StripeTransaction.get({
      id: transaction.stripeSessionId,
    });

    if (existing) {
      console.log(`⚠️ Transaction ${transaction.stripeSessionId} déjà enregistrée`);
      return;
    }

    // Créer la transaction
    const { data, errors } = await dbHandler.models.StripeTransaction.create({
      id: transaction.stripeSessionId,
      stripeSessionId: transaction.stripeSessionId,
      status: transaction.status,
      amountCents: transaction.amountCents,
      currency: transaction.currency,
      customerEmail: transaction.customerEmail,
      stripeMeta: JSON.stringify(transaction.stripeMeta || {}),
    });

    if (errors) {
      throw new Error(`DB error: ${JSON.stringify(errors)}`);
    }

    console.log(`✅ Transaction ${transaction.stripeSessionId} enregistrée`);
  } catch (error: any) {
    console.error('❌ Erreur enregistrement transaction:', error);
    // Ne pas jeter l'exception - webhook Stripe doit retourner 200 même si DB fail
    // mais logger pour investigation
  }
}

/**
 * Handler principal: Traite les événements Stripe
 */
export async function handler(event: any): Promise<any> {
  console.log('🔒 Stripe Webhooks Handler - Début');

  try {
    // Valider la signature du webhook (CRITIQUE)
    const body = event.body || '';
    const signature = event.headers['stripe-signature'] || '';

    if (!signature) {
      console.error('❌ Pas de signature Stripe');
      return { statusCode: 401, body: JSON.stringify({ error: 'Missing signature' }) };
    }

    const stripeEvent = validateWebhookSignature(body, signature);

    console.log(`📨 Événement Stripe reçu: ${stripeEvent.type}`);

    // Traiter les événements pertinents
    switch (stripeEvent.type) {
      case 'checkout.session.completed': {
        const session = stripeEvent.data.object as Stripe.Checkout.Session;
        console.log(`✅ Paiement complété: ${session.id}`);

        await recordStripeTransaction({
          stripeSessionId: session.id,
          stripeMeta: session.metadata || {},
          status: 'completed',
          amountCents: session.amount_total || 0,
          currency: session.currency || 'eur',
          customerEmail: session.customer_email || undefined,
        });

        // TODO: Envoyer confirmation email
        // TODO: Créer facture
        // TODO: Mettre à jour comptabilité si nécessaire
        break;
      }

      case 'checkout.session.async_payment_succeeded': {
        const session = stripeEvent.data.object as Stripe.Checkout.Session;
        console.log(`✅ Paiement asynchrone réussi: ${session.id}`);

        await recordStripeTransaction({
          stripeSessionId: session.id,
          stripeMeta: session.metadata || {},
          status: 'completed',
          amountCents: session.amount_total || 0,
          currency: session.currency || 'eur',
          customerEmail: session.customer_email || undefined,
        });
        break;
      }

      case 'checkout.session.async_payment_failed': {
        const session = stripeEvent.data.object as Stripe.Checkout.Session;
        console.error(`❌ Paiement asynchrone échoué: ${session.id}`);

        await recordStripeTransaction({
          stripeSessionId: session.id,
          stripeMeta: session.metadata || {},
          status: 'failed',
          amountCents: session.amount_total || 0,
          currency: session.currency || 'eur',
          customerEmail: session.customer_email || undefined,
        });
        break;
      }

      case 'charge.failed': {
        const charge = stripeEvent.data.object as Stripe.Charge;
        console.error(`❌ Charge échouée: ${charge.id}`);
        // Logguer pour investigation
        break;
      }

      case 'charge.refunded': {
        const charge = stripeEvent.data.object as Stripe.Charge;
        console.log(`🔄 Remboursement: ${charge.id}`);
        // TODO: Gérer les remboursements
        break;
      }

      default:
        console.log(`ℹ️ Événement ignoré: ${stripeEvent.type}`);
    }

    // IMPORTANT: Retourner 200 OK pour confirmer la réception à Stripe
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ received: true }),
    };
  } catch (error: any) {
    console.error('❌ Erreur Webhooks Stripe:', error);

    // Retourner 400 pour que Stripe réessaye (sauf signature invalid)
    const statusCode = error.message?.includes('signature') ? 401 : 400;

    return {
      statusCode,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message }),
    };
  }
}

export { handler as webhookHandler };
