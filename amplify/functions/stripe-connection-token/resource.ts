import { defineFunction, secret } from '@aws-amplify/backend';

export const stripeConnectionToken = defineFunction({
  name: 'stripe-connection-token',
  resourceGroupName: 'data',
  entry: './handler.ts',
  timeoutSeconds: 11, // bump to force CFN re-resolve SSM secret (sk_live)
  memoryMB: 256,
  environment: {
    STRIPE_SECRET_KEY: secret('STRIPE_SECRET_KEY'),
  },
});
