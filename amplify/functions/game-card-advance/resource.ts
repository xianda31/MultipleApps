import { defineFunction } from '@aws-amplify/backend';

export const gameCardAdvance = defineFunction({
  name: 'game-card-advance',
  resourceGroupName: 'data',
  entry: './handler.ts',
  timeoutSeconds: 30,
  memoryMB: 256,
});
