import { defineFunction, secret } from '@aws-amplify/backend';

export const stripeConnectionToken = defineFunction({
  name: 'stripe-connection-token',
  resourceGroupName: 'data',
  entry: './handler.ts',
  timeoutSeconds: 10,
  memoryMB: 256,
  environment: {
    STRIPE_SECRET_KEY: secret('STRIPE_SECRET_KEY'),
  },
});
