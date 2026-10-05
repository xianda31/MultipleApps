// @ts-nocheck
import { defineFunction } from '@aws-amplify/backend'

export const confirmUser = defineFunction({
  name: 'confirm-user',
  environment: { TARGET_GROUP: 'Membre' },
})