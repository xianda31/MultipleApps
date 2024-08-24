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

  PageArticle: a.model({
    articleId: a.id(),
    pageId: a.id(),
    article: a.belongsTo('Article', 'articleId'),
    page: a.belongsTo('Page', 'pageId'),
  })
    .authorization((allow) => [allow.publicApiKey()]),

  Article: a.model({
    title: a.string(),
    content: a.string(),
    tags: a.string().array(),
    pages: a.hasMany('PageArticle', 'articleId'),
  })
    .authorization((allow) => [allow.publicApiKey()]),


  Page: a.model({
    link: a.string().required(),
    layout: a.string(),
    summary: a.string(),
    menuId: a.id(),
    menu: a.belongsTo('Menu', 'menuId'),
    articles: a.hasMany('PageArticle', 'pageId'),
  })
    .authorization((allow) => [allow.publicApiKey()]),



  Menu: a.model({
    label: a.string().required(),
    summary: a.string(),
    rank: a.integer(),
    pages: a.hasMany('Page', 'menuId'),
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
