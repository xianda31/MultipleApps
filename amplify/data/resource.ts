import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { last } from 'rxjs';

const schema = a.schema({
  Administrator: a.model({
    email: a.string(),
    username: a.string(),
  })
    .authorization((allow) => [allow.publicApiKey()]),

  Member: a.model({
    firstname: a.string(),
    lastname: a.string(),
    license: a.string(),
    email: a.string(),
    username: a.string(),
  })
    .authorization((allow) => [allow.publicApiKey()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'apiKey',
    apiKeyAuthorizationMode: { expiresInDays: 30 }
  },
});
