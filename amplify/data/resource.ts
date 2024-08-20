import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { last } from 'rxjs';

const schema = a.schema({

  Administrator: a.model({
    email: a.string(),
    username: a.string(),
  })
    .authorization((allow) => [allow.publicApiKey()]),

  Member: a.model({
    gender: a.string(),
    firstname: a.string(),
    lastname: a.string(),
    license_number: a.string(),
    birthdate: a.string(),
    city: a.string(),
    season: a.string(),
    email: a.string(),
    phone_one: a.string(),
    orga_license_name: a.string(),
    is_sympathisant: a.boolean()
  })
    .authorization((allow) => [allow.publicApiKey()]),

  Configuration: a.model({
    site: a.json(),
  })
    .authorization((allow) => [allow.publicApiKey()]),

  Menu: a.model({
    // id: a.id(),
    label: a.string().required(),
    has_submenu: a.boolean().required(),
    endItem: a.customType({
      link: a.string().required(),
      pageId: a.string(),
    }),
    // rootmenu: a.belongsTo('Menu', 'id'),
    // submenus: a.hasMany('Menu', 'id'),
  })
    .authorization((allow) => [allow.publicApiKey()]),


  Page: a.model({
    layout: a.enum(['PLAIN', 'HIERARCHICAL', 'CAROUSEL']),
    title: a.string(),
    content: a.string(),
    articles: a.hasMany('Article', 'pageId'),
  })
    .authorization((allow) => [allow.publicApiKey()]),

  Article: a.model({
    title: a.string(),
    content: a.string(),
    tags: a.string().array(),

    pageId: a.id(),
    page: a.belongsTo('Page', 'pageId'),
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
