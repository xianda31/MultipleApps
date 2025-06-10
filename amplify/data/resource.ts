import { type ClientSchema, a, defineData } from '@aws-amplify/backend';




const schema = a.schema({


  // comptabilité

  Operation: a.customType({
    label: a.string().required(),
    member: a.string(),
    values: a.json().required(),
  }),

  BookEntry: a.model({
    season: a.string().required(),
    date: a.date().required(),
    tag: a.string(),
    amounts: a.json().required(),
    operations: a.ref('Operation').array().required(),

    transaction_id: a.string().required(),
    cheque_ref: a.string(),
    deposit_ref: a.string(),
    bank_report: a.string(),

  })
    .authorization((allow) => [
      allow.guest().to(['read']),
      allow.authenticated('identityPool').to(['create','read', 'update',  'delete']),
    ]),

  // cartes de parties 

  TwelveGameCard: a.model({
    id: a.id().required(),
    initial_qty: a.integer().required(),
    licenses: a.string().array().required(),
    stamps: a.string().array().required(),
  })
    .authorization((allow) => [
      allow.guest().to(['create','read']),
      allow.authenticated('identityPool').to(['create','read', 'update',  'delete']),
    ]),

  // Adhérents et produits Club


  Member: a.model({
    license_number: a.string().required(),
    gender: a.string(),
    firstname: a.string(),
    lastname: a.string(),
    birthdate: a.string(),
    city: a.string(),
    season: a.string(),
    email: a.string(),
    phone_one: a.string(),
    orga_license_name: a.string(),
    is_sympathisant: a.boolean(),
    license_status: a.string(),
    license_taken_at: a.string(),
    
  })
    .authorization((allow) => [
      allow.guest().to(['read', 'create']),
      allow.authenticated('identityPool').to(['create','read', 'update',  'delete']),
    ]),

  Product: a.model({
    glyph: a.string().required(),
    description: a.string().required(),
    account: a.string().required(),
    price: a.float().required(),
    paired: a.boolean().required(),
    active: a.boolean().required(),
    info1: a.string(),
  })
    .authorization((allow) => [
      allow.guest().to(['read']),
      allow.authenticated('identityPool')
    ]),

  // Site web

  Article: a.model({
    title: a.string().required(),
    template: a.string().required(),
    content: a.string().required(),
    featured: a.boolean().required(),
    rank: a.integer().required(),
    image: a.string(),
    pageId: a.id(),
    page: a.belongsTo('Page', 'pageId'),
  })
    .authorization((allow) => [
      allow.guest().to(['read']),
      allow.authenticated('identityPool')
    ]),

  Page: a.model({
    link: a.string().required(),
    template: a.string(),
    rank: a.integer(),
    member_only: a.boolean(),
    menuId: a.id(),
    menu: a.belongsTo('Menu', 'menuId'),
    articles: a.hasMany('Article', 'pageId'),
  })
    .authorization((allow) => [
      allow.guest().to(['read']),
      allow.authenticated('identityPool')
    ]),


  Menu: a.model({
    label: a.string().required(),
    // summary: a.string(),
    rank: a.integer(),
    pages: a.hasMany('Page', 'menuId'),
  })
    .authorization((allow) => [
      allow.guest().to(['read']),
      allow.authenticated('identityPool')
    ]),

});



export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'identityPool',
    apiKeyAuthorizationMode: { expiresInDays: 30 }
  },
  // apiKeyAuthorizationMode: { expiresInDays: 2}
});
