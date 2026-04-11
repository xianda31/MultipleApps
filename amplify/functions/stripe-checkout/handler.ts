/**
 * Lambda Stripe Checkout Handler
 * ⚠️ SÉCURITÉ CRITIQUE ⚠️
 * // force redeploy 2026-04-09c   
 * Cette Lambda est le cœur sécurisé du système.
 * TOUT est validé ici, jamais au client.
 */  

import Stripe from 'stripe';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);

// Variables d'environnement
const SALE_ITEM_TABLE = process.env['SALE_ITEM_TABLE_NAME'];
const STRIPE_SECRET_KEY = process.env['STRIPE_SECRET_KEY'];
const STRIPE_PUBLISHABLE_KEY = process.env['STRIPE_PUBLISHABLE_KEY'];

const stripe = new Stripe(STRIPE_SECRET_KEY || 'dummy', {
  apiVersion: '2024-04-10' as any,
});

interface CheckoutRequest {
  productIds: string[];
  quantities: number[];
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
  debtAmountCents?: number;  // Montant de dette optionnel (en centimes)
  assetAmountCents?: number;  // Montant d'avoir optionnel (en centimes)
  discountAmountCents?: number; // Ristourne staff uniquement (mode offline QR)
  memberName?: string;  // Nom du membre (pour traçabilité)
  buyerMemberId?: string; // DynamoDB Member ID (pour traçabilité)
  bookEntryId?: string;  // ID du BookEntry créé avant navigation (BookEntry-first)
  season?: string; // saison comptable
  date?: string; // date ISO YYYY-MM-DD
}

/**
 * Vérifie si l'appelant est un staff (Admin/Editor/System) via les claims Cognito
 */
function isStaffCaller(event: any): boolean {
  const claims =
    event.requestContext?.authorizer?.claims ||
    event.requestContext?.authorizer?.jwt?.claims ||
    {};
  // DEBUG TEMP — à retirer après diagnostic
  console.log('[isStaffCaller] email:', claims['email'], 'sub:', claims['sub'], 'groups:', claims['cognito:groups']);
  // cognito:groups peut être une string CSV ou un tableau selon la config
  const rawGroups = claims['cognito:groups'] || '';
  const groups: string[] = Array.isArray(rawGroups)
    ? rawGroups
    : rawGroups.split(',').map((g: string) => g.trim()).filter(Boolean);
  const result = groups.some((g: string) => ['Administrateur', 'Editeur', 'Systeme'].includes(g));
  if (!result) console.warn('[isStaffCaller] REFUSED — groups found:', groups);
  return result;
}

/**
 * Valide et récupère les produits depuis la DB
 * C'est LA fonction critique qui empêche la manipulation des prix
 */
async function getValidatedProducts(
  productIds: string[],
  quantities: number[]
): Promise<Array<{ product: any; quantity: number; price: number }>> {
  if (!SALE_ITEM_TABLE) {
    throw new Error('SALE_ITEM_TABLE_NAME not configured');
  }
  
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
    const productId = productIds[i];
    const result = await docClient.send(new GetCommand({
      TableName: SALE_ITEM_TABLE!,
      Key: { id: productId },
    }));
    
    const product = result.Item;
    if (!product) {
      throw new Error(`Produit non trouvé: ${productId}`);
    }
    if (!product.active) {
      throw new Error(`Produit inactif: ${productId}`);
    }
    if (!product.stripeEnabled) {
      throw new Error(`Produit non disponible en ligne: ${productId}`);
    }

    // Valider et convertir le prix
    const priceEur = parseFloat(product.price);
    if (isNaN(priceEur) || priceEur < 0) {
      throw new Error(`Invalid product price for ${productId}: ${product.price} (parsed as ${priceEur})`);
    }
    
    const priceCents = Math.round(priceEur * 100);
    if (!Number.isInteger(priceCents) || priceCents < 0) {
      throw new Error(`Invalid price conversion for ${productId}: ${priceEur}€ = ${priceCents}¢ (invalid)`);
    }
    
    // price est en euros dans DynamoDB (ex: 5.00 = 5,00€)
    validatedItems.push({
      product,
      quantity: quantities[i],
      price: priceCents, // convertir en centimes pour Stripe
    });
  }

  return validatedItems;
}

/**
/**
 * Handler principal: Route vers checkout, receipt ou payout-lookup selon le path
 */
export async function handler(event: any): Promise<any> {
  const path = event.rawPath || event.path || '';
  if (path.endsWith('/receipt')) {
    return handleReceipt(event);
  }
  if (path.endsWith('/payout-lookup')) {
    return handlePayoutLookup(event);
  }
  if (path.endsWith('/payout-list')) {
    return handlePayoutList(event);
  }
  return handleCheckout(event);
}

/**
 * Récupère le receipt_url Stripe à partir d'un sessionId
 */
async function handleReceipt(event: any): Promise<any> {
  if (!STRIPE_SECRET_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'STRIPE_SECRET_KEY not configured' }) };
  }

  try {
    let bodyObj: any;
    if (typeof event.body === 'string') {
      bodyObj = JSON.parse(event.body);
    } else if (typeof event.body === 'object' && event.body !== null) {
      bodyObj = event.body;
    } else {
      bodyObj = {};
    }

    const sessionId = bodyObj.sessionId;
    if (!sessionId || typeof sessionId !== 'string' || !sessionId.startsWith('cs_')) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid sessionId' }) };
    }

    // Retrieve session → payment_intent → latest_charge → receipt_url
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent.latest_charge'],
    });

    const pi = session.payment_intent as Stripe.PaymentIntent | null;
    const charge = pi?.latest_charge as Stripe.Charge | null;
    const receiptUrl = charge?.receipt_url || null;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ data: { receiptUrl } }),
    };
  } catch (error: any) {
    console.error('[stripe-receipt] ERROR:', error?.message || error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Failed to retrieve receipt' }),
    };
  }
}

/**
 * Crée une session Stripe Checkout sécurisée
 */
async function handleCheckout(event: any): Promise<any> {
  if (!SALE_ITEM_TABLE) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'SALE_ITEM_TABLE_NAME env var not configured' }),
    };
  }
  
  if (!STRIPE_SECRET_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'STRIPE_SECRET_KEY env var not configured' }),
    };
  }
  
  try {
    // Parser le body - gérer plusieurs formats possibles
    let request: CheckoutRequest;
    try {
      let bodyObj: any;
      
      // Format 1: event.body est une string JSON
      if (typeof event.body === 'string') {
        bodyObj = JSON.parse(event.body);
      }
      // Format 2: event.body est déjà un objet
      else if (typeof event.body === 'object' && event.body !== null) {
        bodyObj = event.body;
      }
      // Format 3: Les paramètres sont directement sur event (certaines setups Amplify)
      else if (event.productIds) {
        bodyObj = {
          productIds: event.productIds,
          quantities: event.quantities,
          successUrl: event.successUrl,
          cancelUrl: event.cancelUrl,
          customerEmail: event.customerEmail,
          debtAmountCents: event.debtAmountCents,
          assetAmountCents: event.assetAmountCents,
          memberName: event.memberName,
          buyerMemberId: event.buyerMemberId,
          bookEntryId: event.bookEntryId,
          season: event.season,
          date: event.date,
        };
      }
      // Format 4: JSON string fallback
      else {
        bodyObj = JSON.parse(JSON.stringify(event));
      }
      
      request = bodyObj || {};
    } catch (parseError: any) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid JSON body: ' + parseError.message }),
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
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = validatedItems.map(item => {
      const unitAmount = item.price;
      
      // Valider que le prix est positif
      if (unitAmount <= 0) {
        throw new Error(`Invalid product price: ${unitAmount}¢ (must be > 0)`);
      }
      
      return {
        price_data: {
          currency: 'eur',
          product_data: {
            name: item.product.name || item.product.description || item.product.id,
            metadata: {
              productId: item.product.id,
              account: item.product.account,
            },
          },
          unit_amount: unitAmount,
        },
        quantity: item.quantity,
      };
    });

    // Valider et normaliser debt/asset/discount amounts
    const debtValue = request.debtAmountCents;
    const assetValue = request.assetAmountCents;
    const discountValue = request.discountAmountCents;

    const debtAmountCents = (debtValue && typeof debtValue === 'number' && debtValue > 0)
      ? Math.floor(debtValue)
      : 0;
    const assetAmountCents = (assetValue && typeof assetValue === 'number' && assetValue > 0)
      ? Math.floor(assetValue)
      : 0;
    // 🔒 Ristourne acceptée uniquement pour les staff authentifiés
    let discountAmountCents = 0;
    if (discountValue && typeof discountValue === 'number' && discountValue > 0) {
      if (!isStaffCaller(event)) {
        return {
          statusCode: 403,
          body: JSON.stringify({ error: 'Discount not allowed for non-staff purchases' }),
        };
      }
      discountAmountCents = Math.floor(discountValue);
    }

    if (debtAmountCents < 0 || !Number.isInteger(debtAmountCents)) {
      throw new Error(`Invalid debtAmountCents: ${debtAmountCents}`);
    }
    if (assetAmountCents < 0 || !Number.isInteger(assetAmountCents)) {
      throw new Error(`Invalid assetAmountCents: ${assetAmountCents}`);
    }
    if (discountAmountCents < 0 || !Number.isInteger(discountAmountCents)) {
      throw new Error(`Invalid discountAmountCents: ${discountAmountCents}`);
    }

    // Ajouter la dette en tant que line item séparé si présent
    if (debtAmountCents > 0) {
      lineItems.push({
        price_data: {
          currency: 'eur',
          product_data: {
            name: `Règlement de dette - ${request.memberName || 'Membre'}`,
            metadata: {
              type: 'debt_payment',
              memberName: request.memberName || '',
            },
          },
          unit_amount: debtAmountCents,
        },
        quantity: 1,
      });
    }

    // ⚠️ Stripe n'accepte PAS les montants négatifs dans unit_amount!
    // Pour déduire avoir + ristourne, on crée UN SEUL coupon Stripe combiné
    let combinedCouponId: string | undefined;
    const totalBonusCents = assetAmountCents + discountAmountCents;
    if (totalBonusCents > 0) {
      const couponName = discountAmountCents > 0 && assetAmountCents > 0
        ? `Avoir + Ristourne - ${request.memberName || 'Membre'}`
        : discountAmountCents > 0
          ? `Ristourne - ${request.memberName || 'Membre'}`
          : `Avoir retenu - ${request.memberName || 'Membre'}`;
      const coupon = await stripe.coupons.create({
        amount_off: totalBonusCents,
        currency: 'eur',
        duration: 'once',
        name: couponName,
      });
      combinedCouponId = coupon.id;
    }

    // Calculer le montant total validé
    const totalAmountCents = validatedItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    ) + debtAmountCents - assetAmountCents - discountAmountCents;

    // Valider le montant total
    if (totalAmountCents < 0) {
      throw new Error(`Invalid total amount (negative): ${totalAmountCents}¢`);
    }
    if (!Number.isInteger(totalAmountCents)) {
      throw new Error(`Invalid total amount (not integer): ${totalAmountCents}¢`);
    }

    // 🔒 Créer la session Stripe
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${request.successUrl}${request.successUrl.includes('?') ? '&' : '?'}session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: request.cancelUrl,
      customer_email: request.customerEmail,
      metadata: {
        userId: event.requestContext?.authorizer?.claims?.sub || 'guest',
        totalAmount: totalAmountCents.toString(),
        productCount: validatedItems.length.toString(),
        memberName: request.memberName || '',
        debtAmountCents: debtAmountCents.toString(),
        assetAmountCents: assetAmountCents.toString(),
        discountAmountCents: discountAmountCents.toString(),
        buyerMemberId: request.buyerMemberId || '',
        bookEntryId: request.bookEntryId || '',
        season: request.season || '',
        date: request.date || '',
        // stripeTag sera ajouté après création de la session (lié au sessionId)
      },
      automatic_tax: {
        enabled: false,
      },
    };
    
    // Appliquer le coupon combiné (avoir + ristourne) si présent
    if (combinedCouponId) {
      sessionParams.discounts = [{ coupon: combinedCouponId }];
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    // stripeTag dérivé du sessionId — calculé côté webhook via session.id.slice(-12)
    // (les sessions Stripe sont immutables après création, pas de sessions.update)

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
    console.error('[stripe-checkout] ERROR:', error?.message || error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Checkout failed',
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

/**
 * Liste les payouts Stripe récents (30 derniers jours, max 30)
 */
async function handlePayoutList(_event: any): Promise<any> {
  const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  if (!STRIPE_SECRET_KEY) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'STRIPE_SECRET_KEY not configured' }) };
  }
  try {
    const since = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60; // 30 jours
    const payouts = await stripe.payouts.list({
      limit: 30,
      created: { gte: since },
    });
    const result = payouts.data.map(p => ({
      id: p.id,
      amountCents: p.amount,
      status: p.status,
      arrivalDate: new Date(p.arrival_date * 1000).toISOString().slice(0, 10),
      description: p.description || null,
      automatic: p.automatic,
    }));
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ payouts: result }),
    };
  } catch (error: any) {
    console.error('[payout-list] ERROR:', error?.message || error);
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: 'Failed to list payouts: ' + (error?.message || 'unknown') }),
    };
  }
}

/**
 * Lookup payout Stripe : retourne les charges associées à un payout
 * ⚠️ Admin-only — vérifié par la route API Gateway (userPoolAuthorizer)
 */
async function handlePayoutLookup(event: any): Promise<any> {
  const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

  // DEBUG TEMP: auth désactivée pour test fonctionnel
  // if (!isStaffCaller(event)) {
  //   return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Admin required' }) };
  // }
  if (!STRIPE_SECRET_KEY) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'STRIPE_SECRET_KEY not configured' }) };
  }

  try {
    let bodyObj: any = {};
    if (typeof event.body === 'string') bodyObj = JSON.parse(event.body);
    else if (event.body) bodyObj = event.body;

    const payoutId = bodyObj.payoutId;
    if (!payoutId || typeof payoutId !== 'string' || !payoutId.startsWith('po_')) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid payoutId (expected po_...)' }) };
    }

    // Récupérer toutes les balance transactions du payout, en expandant la charge et son payment_intent
    let btList: Stripe.ApiList<Stripe.BalanceTransaction>;
    try {
      btList = await stripe.balanceTransactions.list({
        payout: payoutId,
        limit: 100,
        expand: ['data.source', 'data.source.payment_intent'],
      });
    } catch (stripeErr: any) {
      const isManualPayout = stripeErr?.message?.toLowerCase().includes('manual')
        || stripeErr?.message?.toLowerCase().includes('payout_not_found')
        || stripeErr?.code === 'invalid_request_error';
      if (isManualPayout) {
        return {
          statusCode: 200,
          headers: CORS,
          body: JSON.stringify({
            payoutId,
            isManual: true,
            totalGrossCents: 0,
            totalFeesCents: 0,
            totalNetCents: 0,
            charges: [],
          }),
        };
      }
      throw stripeErr;
    }

    const chargeItems = btList.data.filter((bt: any) => bt.type === 'charge');

    // Pour chaque charge, résoudre le stripeTag via la checkout session (session.id.slice(-12))
    // car les metadata PaymentIntent sont vides (stripeTag calculé après création session)
    const charges = await Promise.all(chargeItems.map(async (bt: any) => {
      const charge = bt.source as Stripe.Charge;
      const pi = charge?.payment_intent as Stripe.PaymentIntent | null;
      const meta = pi?.metadata || {};

      // Priorité 1 : metadata directe (futures sessions)
      let stripeTag: string | null = meta['stripeTag'] || null;
      let bookEntryId: string | null = meta['bookEntryId'] || null;

      // Priorité 2 : retrouver la checkout session via payment_intent → session.id.slice(-12)
      if (!stripeTag && pi?.id) {
        try {
          const sessions = await stripe.checkout.sessions.list({ payment_intent: pi.id, limit: 1 });
          if (sessions.data.length > 0) {
            const sessionId = sessions.data[0].id;
            stripeTag = `stripe:${sessionId.slice(-12)}`;
            bookEntryId = bookEntryId || sessions.data[0].metadata?.['bookEntryId'] || null;
          }
        } catch (e) {
          console.warn(`[payout-lookup] Could not resolve session for PI ${pi.id}:`, e);
        }
      }

      return {
        chargeId: charge?.id || null,
        stripeTag,
        bookEntryId,
        grossCents: bt.amount,
        feesCents: bt.fee,
        netCents: bt.net,
      };
    }));

    const charges_final = charges;

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        payoutId,
        totalGrossCents: charges_final.reduce((s: number, c: any) => s + c.grossCents, 0),
        totalFeesCents: charges_final.reduce((s: number, c: any) => s + c.feesCents, 0),
        totalNetCents: charges_final.reduce((s: number, c: any) => s + c.netCents, 0),
        charges: charges_final,
      }),
    };
  } catch (error: any) {
    console.error('[payout-lookup] ERROR:', error?.message || error);
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: 'Failed to lookup payout: ' + (error?.message || 'unknown') }),
    };
  }
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export { handler as checkoutHandler };
