/**
 * Utilitaires pour tags Stripe
 */

/**
 * Génère un tag court et lisible pour une session Stripe
 * @param sessionId L'ID de session Stripe complet
 * @returns Tag au format 'stripe:XXXXX' (12 derniers caractères)
 */
export function getShortStripeTag(sessionId: string): string {
  const shortId = sessionId.slice(-12);
  return `stripe:${shortId}`;
}
