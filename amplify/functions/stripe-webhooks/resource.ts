import { defineFunction } from '@aws-amplify/backend';

/**
 * Stripe Webhooks Lambda Function
 * Traite les événements Stripe de paiement
 */
export const stripeWebhooks = defineFunction({
  name: 'stripe-webhooks',
  entry: './handler.ts',
  timeoutSeconds: 30,
  memoryMB: 512,
  environment: {
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || '',
  },
});
