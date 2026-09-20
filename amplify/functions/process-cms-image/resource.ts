import { defineFunction } from '@aws-amplify/backend';

export const processCmsImage = defineFunction({
  name: 'process-cms-image',
  resourceGroupName: 'storage',
  entry: './handler.ts',
  runtime: 20,
  architecture: 'arm64',
  memoryMB: 1024,
  timeoutSeconds: 60,
});
