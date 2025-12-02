import { defineFunction } from '@aws-amplify/backend';

export const emailUnsubscribe = defineFunction({
  name: 'email-unsubscribe',
  entry: './handler.ts',
  timeoutSeconds: 30,
  resourceGroupName: 'data', // Assigner au stack data car accède à la table Member
  bundling: {
    externalModules: ['@aws-sdk/client-dynamodb', '@aws-sdk/lib-dynamodb']
  }
});
