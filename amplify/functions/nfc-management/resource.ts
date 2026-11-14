import { defineFunction } from '@aws-amplify/backend';

export const nfcManagement = defineFunction({
  name: 'nfc-management',
  resourceGroupName: 'data',
  entry: './handler.ts',
  timeoutSeconds: 30,
  memoryMB: 512,
});
