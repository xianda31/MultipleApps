/**
 * Lambda Stripe Checkout Handler
 * ⚠️ SÉCURITÉ CRITIQUE ⚠️
 * 
 * Cette Lambda est le cœur sécurisé du système.
 * TOUT est validé ici, jamais au client.
 */

import Stripe from 'stripe';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);
const SALE_ITEM_TABLE = process.env['SALE_ITEM_TABLE_NAME'] || '';

const stripe = new Stripe(process.env['STRIPE_SECRET_KEY'] || '', {
  apiVersion: '2024-04-10' as any,
});

interface CheckoutRequest {
  productIds: string[];
  quantities: number[];
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
}

/**
 * Valide et récupère les produits depuis la DB
 * C'est LA fonction critique qui empêche la manipulation des prix
 */
async function getValidatedProducts(
  productIds: string[],
  quantities: number[]
): Promise<Array<{ product: any; quantity: number; price: number }>> {
  // Valider que les IDs et quantités matchent
  if (productIds.length !== quantities.length) {
    throw new Error('Mismatch between product IDs and quantities');
  }

  // Valider les quantités
  for (const qty of quantities) {
    if (qty <= 0 || qty > 100) {
      throw new Error(`Invalid quantity: ${qty}`);
    }
  }

  const validatedItems: Array<{ product: any; quantity: number; price: number }> = [];

  for (let i = 0; i < productIds.length; i++) {
    const result = await docClient.send(new GetCommand({
      TableName: SALE_ITEM_TABLE,
      Key: { id: productIds[i] },
    }));

    const product = result.Item;
    if (!product) {
      throw new Error(`Produit non trouvé: ${productIds[i]}`);
    }
    if (!product.active) {
      throw new Error(`Produit inactif: ${productIds[i]}`);
    }
    if (!product.stripeEnabled) {
      throw new Error(`Produit non disponible en ligne: ${productIds[i]}`);
    }

    // price est en euros dans DynamoDB (ex: 5.00 = 5,00€)
    validatedItems.push({
      product,
      quantity: quantities[i],
      price: Math.round((product.price as number) * 100), // convertir en centimes pour Stripe
    });
  }

  return validatedItems;
}

/**
 * Handler principal: Crée une session Stripe Checkout sécurisée
 */
export async function handler(event: any): Promise<any> {
  console.log('[stripe-checkout] handler start');

  try {
    // Parser le body
    let request: CheckoutRequest;
    try {
      const rawBody = typeof event.body === 'string' ? event.body : JSON.stringify(event.body);
      request = JSON.parse(rawBody || '{}');
      console.log('Request parsed:', JSON.stringify({ successUrl: request.successUrl, cancelUrl: request.cancelUrl, productIds: request.productIds }));
    } catch {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid JSON body' }),
      };
    }

    // Valider les URLs de redirection
    if (!isValidUrl(request.successUrl) || !isValidUrl(request.cancelUrl)) {
      console.log('URL validation failed:', { successUrl: request.successUrl, cancelUrl: request.cancelUrl });
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid redirect URLs' }),
      };
    }

    // Valider email si fourni
    if (request.customerEmail && !isValidEmail(request.customerEmail)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid email' }),
      };
    }

    // 🔒 VALIDATION CRITIQUE: Récupérer les vrais produits et prix depuis la DB
    const validatedItems = await getValidatedProducts(
      request.productIds,
      request.quantities
    );

    if (validatedItems.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No valid items in cart' }),
      };
    }

    // 🔒 Construire les line items pour Stripe (avec prix vérifiés)
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = validatedItems.map(item => ({
      price_data: {
        currency: 'eur',
        product_data: {
          name: item.product.name || item.product.description || item.product.id,
          metadata: {
            productId: item.product.id,
            account: item.product.account,
          },
        },
        unit_amount: item.price, // en centimes (converti depuis euros)
      },
      quantity: item.quantity,
    }));

    // Calculer le montant total validé
    const totalAmountCents = validatedItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    console.log('[stripe-checkout] montant valide:', (totalAmountCents / 100).toFixed(2), 'EUR pour', validatedItems.length, 'item(s)');

    // 🔒 Créer la session Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${request.successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: request.cancelUrl,
      customer_email: request.customerEmail,
      metadata: {
        userId: event.requestContext?.authorizer?.claims?.sub || 'guest',
        totalAmount: totalAmountCents.toString(),
        productCount: validatedItems.length.toString(),
      },
      // Webhook pour confirmation
      automatic_tax: {
        enabled: false, // À configurer si TVA nécessaire
      },
    });

    console.log('[stripe-checkout] session creee:', session.id);

    // Retourner en réponse
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        data: {
          sessionId: session.id,
          sessionUrl: session.url,
          publishableKey: process.env['STRIPE_PUBLISHABLE_KEY'],
        },
      }),
    };
  } catch (error: any) {
    console.error('CHECKOUT_ERROR name=' + error?.name + ' msg=' + error?.message + ' code=' + error?.code);

    // Ne pas révéler les détails techniques
    const errorMessage = error?.message?.includes('Produit')
      ? error.message
      : 'Erreur lors de la création de la session de paiement';

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: errorMessage,
      }),
    };
  }
}

/**
 * Utilitaires de validation
 */
function isValidUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.hostname === 'localhost';
  } catch {
    return false;
  }
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export { handler as checkoutHandler };
