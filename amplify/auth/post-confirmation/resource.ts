import { defineFunction } from '@aws-amplify/backend';

export const postConfirmation = defineFunction({
  name: 'post-confirmation',
  environment: {TARGET_GROUP:'Membre'},
  resourceGroupName: 'auth'
});