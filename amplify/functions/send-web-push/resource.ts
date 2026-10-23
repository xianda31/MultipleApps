import { defineFunction } from '@aws-amplify/backend';

export const sendWebPush = defineFunction({
  name: 'send-web-push',
  resourceGroupName: 'data',
  entry: './handler.ts',
  timeoutSeconds: 60,
  memoryMB: 256,
});
