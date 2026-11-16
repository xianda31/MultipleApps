import { defineFunction } from '@aws-amplify/backend';

export const gamePlayers = defineFunction({
  name: 'game-players',
  resourceGroupName: 'data',
  entry: './handler.ts',
  timeoutSeconds: 30,
  memoryMB: 256,
});
