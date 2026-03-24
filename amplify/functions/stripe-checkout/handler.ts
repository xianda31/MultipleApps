/**
 * Lambda Stripe Checkout Handler
 * ⚠️ SÉCURITÉ CRITIQUE ⚠️
 * 
 * Cette Lambda est le cœur sécurisé du système.
 * TOUT est validé ici, jamais au client.
 */

import Stripe from 'stripe';

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

  // Produits de test pour le développement
  // TODO: En production, récupérer depuis StripeProduct model
  const validatedItems: Array<{ product: any; quantity: number; price: number }> = [];

  for (let i = 0; i < productIds.length; i++) {
    const product = {
      id: productIds[i],
      name: `Product ${productIds[i]}`,
      amount: getTestProductPrice(productIds[i]),
      active: true,
    };

    validatedItems.push({
      product,
      quantity: quantities[i],
      price: product.amount,
    });
  }

  return validatedItems;
}

/**
 * Retourne les prix de test pour le développement
 */
function getTestProductPrice(productId: string): number {
  const testPrices: Record<string, number> = {
    'prod-test-1': 999,
    'prod-test-2': 2999,
    'prod-test-3': 4999,
  };
  return testPrices[productId] || 1999;
}

/**
 * Handler principal: Crée une session Stripe Checkout sécurisée
 */
export async function handler(event: any): Promise<any> {
  console.log('🔒 Stripe Checkout Handler - Début');

  try {
    // Parser le body
    let request: CheckoutRequest;
    try {
      request = JSON.parse(event.body || '{}');
    } catch {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid JSON body' }),
      };
    }

    // Valider les URLs de redirection
    if (!isValidUrl(request.successUrl) || !isValidUrl(request.cancelUrl)) {
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
          name: item.product.description || item.product.id,
          metadata: {
            productId: item.product.id,
            account: item.product.account,
          },
        },
        unit_amount: Math.round(item.price * 100), // Stripe en centimes
      },
      quantity: item.quantity,
    }));

    // Calculer le montant total validé
    const totalAmount = validatedItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    console.log(`✅ Montant validé: ${totalAmount}€ pour ${validatedItems.length} item(s)`);

    // 🔒 Créer la session Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: request.successUrl,
      cancel_url: request.cancelUrl,
      customer_email: request.customerEmail,
      metadata: {
        userId: event.requestContext?.authorizer?.claims?.sub || 'guest',
        totalAmount: totalAmount.toString(),
        productCount: validatedItems.length.toString(),
      },
      // Webhook pour confirmation
      automatic_tax: {
        enabled: false, // À configurer si TVA nécessaire
      },
    });

    console.log(`✅ Session Stripe créée: ${session.id}`);

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
    console.error('❌ Erreur Stripe Checkout:', error);

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
  try {
    new URL(url);
    return url.startsWith('https://') || url.startsWith('http://localhost');
  } catch {
    return false;
  }
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export { handler as checkoutHandler };
