/**
 * Lambda Stripe Webhooks Handler
 * ⚠️ SÉCURITÉ CRITIQUE ⚠️
 * 
 * Reçoit et valide les événements Stripe
 * Enregistre les transactions de paiement dans StripeTransaction (DynamoDB)
 * ⚠️ Pas de logique métier ici — le BookEntry est créé côté frontend Angular
 */

import Stripe from 'stripe';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);

const stripe = new Stripe(process.env['STRIPE_SECRET_KEY'] || '', {
  apiVersion: '2024-04-10' as any,
});

const WEBHOOK_SECRET = process.env['STRIPE_WEBHOOK_SECRET'] || '';
const STRIPE_TRANSACTION_TABLE = process.env['STRIPE_TRANSACTION_TABLE_NAME'] || '';

/**
 * Valide la signature du webhook Stripe
 */
function validateWebhookSignature(body: string, signature: string): any {
  if (!WEBHOOK_SECRET) {
    throw new Error('STRIPE_WEBHOOK_SECRET not configured');
  }
  return stripe.webhooks.constructEvent(body, signature, WEBHOOK_SECRET);
}

/**
 * Enregistre le paiement Stripe dans StripeTransaction DynamoDB
 * Rôle unique : persistance des données brutes. Zéro logique métier.
 */
async function recordStripeTransaction(session: Stripe.Checkout.Session): Promise<void> {
  if (!STRIPE_TRANSACTION_TABLE) {
    console.error('STRIPE_TRANSACTION_TABLE_NAME not configured — transaction not recorded');
    return;
  }

  // Vérifier si déjà enregistré (idempotence Stripe)
  const existing = await docClient.send(new GetCommand({
    TableName: STRIPE_TRANSACTION_TABLE,
    Key: { id: session.id },
  }));
  if (existing.Item) {
    console.log(`Transaction ${session.id} already recorded — skipping`);
    return;
  }

  const meta = session.metadata || {};
  const now = new Date().toISOString();

  await docClient.send(new PutCommand({
    TableName: STRIPE_TRANSACTION_TABLE,
    Item: {
      id: session.id,
      stripeSessionId: session.id,
      stripeTag: meta['stripeTag'] || `stripe:${session.id.slice(-12)}`,  // lien de réconciliation → BookEntry.stripeTag
      bookEntryId: meta['bookEntryId'] || null,                            // lien direct BookEntry (BookEntry-first)
      buyerMemberId: meta['buyerMemberId'] || null,
      status: 'completed',
      amountCents: session.amount_total || 0,
      currency: session.currency || 'eur',
      customerEmail: session.customer_email || null,
      processed: false,
      ttl: Math.floor(Date.now() / 1000) + 3 * 365 * 24 * 3600, // expire dans 3 ans (TTL DynamoDB)
      stripeMeta: {
        season: meta['season'] || '',
        date: meta['date'] || '',
        memberName: meta['memberName'] || '',
        debtAmountCents: meta['debtAmountCents'] || '0',
        assetAmountCents: meta['assetAmountCents'] || '0',
        totalAmount: meta['totalAmount'] || '0',
        productCount: meta['productCount'] || '0',
      },
      createdAt: now,
      updatedAt: now,
      __typename: 'StripeTransaction',
    },
    ConditionExpression: 'attribute_not_exists(id)',
  }));

  console.log(`Transaction ${session.id} recorded in DynamoDB`);
}

/**
 * Enregistre une transaction Terminal (PaymentIntent card_present) dans StripeTransaction
 */
async function recordTerminalTransaction(pi: Stripe.PaymentIntent): Promise<void> {
  if (!STRIPE_TRANSACTION_TABLE) {
    console.error('STRIPE_TRANSACTION_TABLE_NAME not configured — terminal transaction not recorded');
    return;
  }

  const existing = await docClient.send(new GetCommand({
    TableName: STRIPE_TRANSACTION_TABLE,
    Key: { id: pi.id },
  }));
  if (existing.Item) {
    console.log(`Terminal transaction ${pi.id} already recorded — skipping`);
    return;
  }

  const meta = pi.metadata || {};
  const now = new Date().toISOString();

  await docClient.send(new PutCommand({
    TableName: STRIPE_TRANSACTION_TABLE,
    Item: {
      id: pi.id,
      stripeSessionId: pi.id,
      stripeTag: meta['stripeTag'] || `stripe:${pi.id.slice(-12)}`,
      bookEntryId: meta['bookEntryId'] || null,
      buyerMemberId: meta['buyerMemberId'] || null,
      status: 'completed',
      amountCents: pi.amount || 0,
      currency: pi.currency || 'eur',
      customerEmail: null,
      processed: false,
      source: 'terminal',
      ttl: Math.floor(Date.now() / 1000) + 3 * 365 * 24 * 3600,
      stripeMeta: {
        season: meta['season'] || '',
        date: meta['date'] || '',
        memberName: meta['memberName'] || '',
        debtAmountCents: '0',
        assetAmountCents: '0',
        totalAmount: String(pi.amount || 0),
        productCount: '0',
      },
      createdAt: now,
      updatedAt: now,
      __typename: 'StripeTransaction',
    },
    ConditionExpression: 'attribute_not_exists(id)',
  }));

  console.log(`Terminal transaction ${pi.id} recorded in DynamoDB`);
}

/**
 * Handler principal: Traite les événements Stripe
 */
export async function handler(event: any): Promise<any> {
  try {
    const body = event.body || '';
    const signature = event.headers['stripe-signature'] || '';

    if (!signature) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Missing signature' }) };
    }

    const stripeEvent = validateWebhookSignature(body, signature);

    console.log(`Événement Stripe: ${stripeEvent.type}`);

    // Traiter les événements pertinents
    switch (stripeEvent.type) {
      case 'checkout.session.completed': {
        const session = stripeEvent.data.object as Stripe.Checkout.Session;
        console.log(`Session Stripe complétée: ${session.id}, payment_status: ${session.payment_status}, payment_intent: ${session.payment_intent}`);
        // Créer la transaction dès que Stripe confirme la session, même si status n'est pas encore 'paid'
        // (le status peut être 'unpaid' en attendant un webhook payment_intent.succeeded)
        await recordStripeTransaction(session);
        break;
      }

      case 'payment_intent.succeeded': {
        // Transactions Terminal (card_present) — enregistrer dans StripeTransaction
        const paymentIntent = stripeEvent.data.object as Stripe.PaymentIntent;
        console.log(`PaymentIntent réussi: ${paymentIntent.id}, source: ${paymentIntent.metadata?.['source']}`);
        if (paymentIntent.metadata?.['source'] === 'terminal') {
          await recordTerminalTransaction(paymentIntent);
        }
        break;
      }

      case 'checkout.session.async_payment_succeeded': {
        const session = stripeEvent.data.object as Stripe.Checkout.Session;
        console.log(`Paiement asynchrone réussi: ${session.id}`);
        await recordStripeTransaction(session);
        break;
      }

      case 'checkout.session.async_payment_failed': {
        const session = stripeEvent.data.object as Stripe.Checkout.Session;
        console.error(`Paiement asynchrone échoué: ${session.id}`);
        break;
      }

      default:
        // Ignorer les autres événements
        break;
    }

    // IMPORTANT: Retourner 200 OK pour confirmer la réception à Stripe
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ received: true }),
    };
  } catch (error: any) {
    console.error('Erreur Webhooks Stripe:', error?.message || error);

    const statusCode = error.message?.includes('signature') ? 401 : 400;

    return {
      statusCode,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message }),
    };
  }
}

export { handler as webhookHandler };
