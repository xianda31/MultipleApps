import { defineFunction } from '@aws-amplify/backend';

export const expireFeaturedSnippets = defineFunction({
  name: 'expire-featured-snippets',
  resourceGroupName: 'data',
  entry: './handler.ts',
  timeoutSeconds: 60,
  memoryMB: 256,
});