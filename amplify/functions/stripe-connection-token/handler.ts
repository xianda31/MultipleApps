/**
 * Lambda Stripe Terminal - Connection Token
 * Fournit un connection token éphémère au SDK Stripe Terminal JS (frontend).
 * ⚠️ Route protégée : staff uniquement (Administrateur / Editeur / Systeme)
 */

import Stripe from 'stripe';

const STRIPE_SECRET_KEY = process.env['STRIPE_SECRET_KEY'];

const stripe = new Stripe(STRIPE_SECRET_KEY || 'dummy', {
  apiVersion: '2024-04-10' as any,
});

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

const ALLOWED_GROUPS = ['Administrateur', 'Editeur', 'Systeme'];

/**
 * Vérifie que l'appelant est un staff via les claims Cognito JWT
 */
function isStaffCaller(event: any): boolean {
  // Strategy 1: decode JWT Authorization header (déjà vérifié par API GW)
  const authHeader: string = event.headers?.authorization || event.headers?.Authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (token) {
    try {
      const payloadB64 = token.split('.')[1];
      const payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf8');
      const payload = JSON.parse(payloadJson);
      const jwtGroups: string[] = Array.isArray(payload['cognito:groups']) ? payload['cognito:groups'] : [];
      if (jwtGroups.some((g: string) => ALLOWED_GROUPS.includes(g))) return true;
      console.warn('[connection-token] JWT groups not allowed:', jwtGroups);
    } catch (e) {
      console.warn('[connection-token] JWT decode failed:', e);
    }
  }

  // Strategy 2: claims parsés par API GW (fallback)
  const claims =
    event.requestContext?.authorizer?.jwt?.claims ||
    event.requestContext?.authorizer?.claims ||
    {};
  const rawGroups = claims['cognito:groups'] ?? '';
  let groups: string[];
  if (Array.isArray(rawGroups)) {
    groups = rawGroups;
  } else if (typeof rawGroups === 'string' && rawGroups.startsWith('[')) {
    try { groups = JSON.parse(rawGroups); } catch { groups = []; }
  } else {
    groups = String(rawGroups).split(/[\s,]+/).map((g: string) => g.trim()).filter(Boolean);
  }

  const result = groups.some((g: string) => ALLOWED_GROUPS.includes(g));
  if (!result) {
    console.warn('[connection-token] REFUSED — groups:', groups);
  }
  return result;
}

export async function handler(event: any): Promise<any> {
  if (!isStaffCaller(event)) {
    return {
      statusCode: 403,
      headers: CORS,
      body: JSON.stringify({ error: 'Staff authorization required' }),
    };
  }

  if (!STRIPE_SECRET_KEY) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: 'STRIPE_SECRET_KEY not configured' }),
    };
  }

  try {
    const connectionToken = await stripe.terminal.connectionTokens.create();
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ secret: connectionToken.secret }),
    };
  } catch (err: any) {
    console.error('[connection-token] Stripe error:', err);
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: 'Failed to create connection token', detail: err.message }),
    };
  }
}
