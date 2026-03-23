import { defineFunction } from '@aws-amplify/backend';

/**
 * Stripe Checkout Lambda Function
 * Avec policy IAM restrictif pour lire les produits depuis la DB
 */
export const stripeCheckout = defineFunction({
  name: 'stripe-checkout',
  entry: './handler.ts',
  timeoutSeconds: 30,
  memoryMB: 512,
  environment: {
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
    STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY || '',
    // Clé webhook à configurer à la main après déploiement
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || '',
  },
});
