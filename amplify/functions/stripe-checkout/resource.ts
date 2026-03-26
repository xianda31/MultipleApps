import { defineFunction, secret } from '@aws-amplify/backend';

export const stripeCheckout = defineFunction({
  name: 'stripe-checkout',
  resourceGroupName: 'data',
  entry: './handler.ts',
  timeoutSeconds: 30,
  memoryMB: 512,
  environment: {
    STRIPE_SECRET_KEY: secret('STRIPE_SECRET_KEY'),
    STRIPE_PUBLISHABLE_KEY: secret('STRIPE_PUBLISHABLE_KEY'),
  },
});
