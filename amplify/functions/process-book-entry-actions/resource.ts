import { defineFunction } from '@aws-amplify/backend';

export const processBookEntryActions = defineFunction({
  name: 'process-book-entry-actions',
  resourceGroupName: 'data',
  entry: './handler.ts',
  timeoutSeconds: 30,
  memoryMB: 256,
});
