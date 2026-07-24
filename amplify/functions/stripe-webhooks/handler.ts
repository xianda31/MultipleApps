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
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { SESClient, SendRawEmailCommand } from '@aws-sdk/client-ses';
import { buildPurchaseConfirmationMailTemplate } from '../shared/mail-template';

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);
const ses = new SESClient({ region: process.env.AWS_REGION });

const stripe = new Stripe(process.env['STRIPE_SECRET_KEY'] || '', {
  apiVersion: '2024-04-10' as any,
});

const WEBHOOK_SECRET = process.env['STRIPE_WEBHOOK_SECRET'] || '';
const STRIPE_TRANSACTION_TABLE = process.env['STRIPE_TRANSACTION_TABLE_NAME'] || '';
const DEFAULT_FROM = '"Bridge Club Saint-Orens" <noreply@bridgeclubsaintorens.fr>';
const DEFAULT_REPLY_TO = '"Bridge Club Saint-Orens" <bridge.saintorens@free.fr>';

function resolvePurchaseEmailTemplateOptions() {
  return {
    brandTitle: process.env['STRIPE_PURCHASE_EMAIL_BRAND_TITLE'] || 'Bridge Club Saint-Orens',
    tagline: process.env['STRIPE_PURCHASE_EMAIL_TAGLINE'] || 'Confirmation de votre achat',
    accentColor: process.env['STRIPE_PURCHASE_EMAIL_ACCENT_COLOR'] || '#2b8a3e',
    footerEmail: process.env['STRIPE_PURCHASE_EMAIL_FOOTER_EMAIL'] || 'bridge.saintorens@free.fr',
    footerWebsite: process.env['STRIPE_PURCHASE_EMAIL_FOOTER_WEBSITE'] || 'https://bridgeclubsaintorens.fr',
  };
}

function formatAmount(cents: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format((cents || 0) / 100);
}

function createRawEmail(
  from: string,
  to: string[],
  subject: string,
  htmlBody: string,
  attachments: Array<{ filename: string; content: string; contentType: string }>,
  replyTo?: string,
): string {
  const boundary = `----=_Part_${Date.now()}`;

  let rawEmail = `From: ${from}\r\n`;
  rawEmail += `To: ${to.join(', ')}\r\n`;
  if (replyTo) {
    rawEmail += `Reply-To: ${replyTo}\r\n`;
  }
  rawEmail += `Subject: ${subject}\r\n`;
  rawEmail += `MIME-Version: 1.0\r\n`;
  rawEmail += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`;

  rawEmail += `--${boundary}\r\n`;
  rawEmail += `Content-Type: text/html; charset=UTF-8\r\n`;
  rawEmail += `Content-Transfer-Encoding: 7bit\r\n\r\n`;
  rawEmail += `${htmlBody}\r\n\r\n`;

  for (const attachment of attachments) {
    rawEmail += `--${boundary}\r\n`;
    rawEmail += `Content-Type: ${attachment.contentType}; name="${attachment.filename}"\r\n`;
    rawEmail += `Content-Disposition: attachment; filename="${attachment.filename}"\r\n`;
    rawEmail += `Content-Transfer-Encoding: base64\r\n\r\n`;
    rawEmail += `${attachment.content}\r\n\r\n`;
  }

  rawEmail += `--${boundary}--`;
  return rawEmail;
}

async function getReceiptAttachment(sessionId: string): Promise<{ receiptUrl: string | null; attachment: { filename: string; content: string; contentType: string } | null }> {
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['payment_intent.latest_charge'],
  });

  const pi = session.payment_intent as Stripe.PaymentIntent | null;
  const charge = pi?.latest_charge as Stripe.Charge | null;
  const receiptUrl = charge?.receipt_url || null;
  if (!receiptUrl) {
    return { receiptUrl: null, attachment: null };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(receiptUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      return { receiptUrl, attachment: null };
    }

    const contentType = response.headers.get('content-type') || 'text/html; charset=UTF-8';
    const buffer = Buffer.from(await response.arrayBuffer());
    const filename = contentType.includes('pdf')
      ? `recu-stripe-${sessionId}.pdf`
      : `recu-stripe-${sessionId}.html`;

    return {
      receiptUrl,
      attachment: {
        filename,
        content: buffer.toString('base64'),
        contentType,
      },
    };
  } catch (error) {
    console.error('[stripe-mail] Unable to fetch receipt attachment:', error);
    return { receiptUrl, attachment: null };
  }
}

async function sendPurchaseConfirmationEmail(session: Stripe.Checkout.Session): Promise<void> {
  const recipient = session.customer_email || session.customer_details?.email || null;
  if (!recipient) {
    console.log('[stripe-mail] No customer email available for session', session.id);
    return;
  }

  if (!STRIPE_TRANSACTION_TABLE) {
    console.error('[stripe-mail] STRIPE_TRANSACTION_TABLE_NAME not configured — email skipped');
    return;
  }

  const current = await docClient.send(new GetCommand({
    TableName: STRIPE_TRANSACTION_TABLE,
    Key: { id: session.id },
  }));

  const existing = current.Item as any | undefined;
  if (!existing) {
    console.log('[stripe-mail] Transaction not yet recorded, email skipped for', session.id);
    return;
  }
  if (existing.confirmationEmailSentAt) {
    console.log('[stripe-mail] Confirmation email already sent for', session.id);
    return;
  }

  const claimAt = new Date().toISOString();
  try {
    await docClient.send(new UpdateCommand({
      TableName: STRIPE_TRANSACTION_TABLE,
      Key: { id: session.id },
      UpdateExpression: 'SET confirmationEmailProcessingAt = :now, updatedAt = :now',
      ConditionExpression: 'attribute_not_exists(confirmationEmailSentAt) AND attribute_not_exists(confirmationEmailProcessingAt)',
      ExpressionAttributeValues: {
        ':now': claimAt,
      },
    }));
  } catch (error: any) {
    console.log('[stripe-mail] Email claim skipped for', session.id, '-', error?.message || error);
    return;
  }

  const memberName = String(session.metadata?.memberName || session.customer_details?.name || '');
  const amount = formatAmount(session.amount_total || 0);
  const currency = String(session.currency || 'eur').toUpperCase();
  const { receiptUrl, attachment } = await getReceiptAttachment(session.id);
  const subject = `Confirmation de votre achat - ${amount}`;

  const bodyHtml = buildPurchaseConfirmationMailTemplate({
    memberName,
    amount,
    currency,
    receiptUrl,
  }, resolvePurchaseEmailTemplateOptions());

  const rawEmail = createRawEmail(
    DEFAULT_FROM,
    [recipient],
    subject,
    bodyHtml,
    attachment ? [attachment] : [],
    DEFAULT_REPLY_TO,
  );

  try {
    await ses.send(new SendRawEmailCommand({
      RawMessage: { Data: Buffer.from(rawEmail) },
      Destinations: [recipient],
      Source: DEFAULT_FROM,
    }));

    await docClient.send(new UpdateCommand({
      TableName: STRIPE_TRANSACTION_TABLE,
      Key: { id: session.id },
      UpdateExpression: 'SET confirmationEmailSentAt = :now, updatedAt = :now REMOVE confirmationEmailProcessingAt, confirmationEmailError',
      ExpressionAttributeValues: {
        ':now': new Date().toISOString(),
      },
    }));

    console.log('[stripe-mail] Confirmation email sent to', recipient, 'for session', session.id);
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    console.error('[stripe-mail] Failed to send confirmation email for', session.id, errorMessage);
    await docClient.send(new UpdateCommand({
      TableName: STRIPE_TRANSACTION_TABLE,
      Key: { id: session.id },
      UpdateExpression: 'SET confirmationEmailError = :error, updatedAt = :now REMOVE confirmationEmailProcessingAt',
      ExpressionAttributeValues: {
        ':error': errorMessage,
        ':now': new Date().toISOString(),
      },
    })).catch(() => undefined);
  }
}

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
        if (session.payment_status === 'paid' || session.payment_status === 'no_payment_required') {
          await sendPurchaseConfirmationEmail(session);
        }
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
        await sendPurchaseConfirmationEmail(session);
        break;
      }

      case 'checkout.session.async_payment_failed': {
        const session = stripeEvent.data.object as Stripe.Checkout.Session;
        console.error(`Paiement asynchrone échoué: ${session.id}`);
        break;
      }

      case 'checkout.session.expired': {
        const session = stripeEvent.data.object as Stripe.Checkout.Session;
        console.log(`Session Stripe expirée: ${session.id}`);
        if (STRIPE_TRANSACTION_TABLE) {
          await docClient.send(new UpdateCommand({
            TableName: STRIPE_TRANSACTION_TABLE,
            Key: { id: session.id },
            UpdateExpression: 'SET #status = :status, abandonedAt = :now, updatedAt = :now',
            ExpressionAttributeNames: {
              '#status': 'status',
            },
            ExpressionAttributeValues: {
              ':status': 'abandoned',
              ':now': new Date().toISOString(),
            },
          })).catch((err) => console.error(`[checkout.session.expired] Failed to update ${session.id}:`, err));
        }
        break;
      }

      case 'payment_intent.canceled': {
        const paymentIntent = stripeEvent.data.object as Stripe.PaymentIntent;
        console.log(`PaymentIntent annulé: ${paymentIntent.id}`);
        if (STRIPE_TRANSACTION_TABLE) {
          await docClient.send(new UpdateCommand({
            TableName: STRIPE_TRANSACTION_TABLE,
            Key: { id: paymentIntent.id },
            UpdateExpression: 'SET #status = :status, abandonedAt = :now, updatedAt = :now',
            ExpressionAttributeNames: {
              '#status': 'status',
            },
            ExpressionAttributeValues: {
              ':status': 'abandoned',
              ':now': new Date().toISOString(),
            },
          })).catch((err) => console.error(`[payment_intent.canceled] Failed to update ${paymentIntent.id}:`, err));
        }
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
