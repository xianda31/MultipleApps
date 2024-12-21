import { type ClientSchema, a, defineData } from '@aws-amplify/backend';




const schema = a.schema({

  Product: a.model({
    glyph: a.string().required(),
    description: a.string().required(),
    account: a.string().required(),
    price: a.float().required(),
    paired: a.boolean().required(),
    active: a.boolean().required(),
  })
    .authorization((allow) => [allow.publicApiKey()]),


  // Record: a.model({
  //   class: a.string().required(),
  //   season: a.string().required(),
  //   amount: a.float().required(),

  //   sale_id: a.id().required(),
  //   sale: a.belongsTo('Sale', 'sale_id'),

  //   member_id: a.id(),

  //   mode: a.string(),
  //   // bank: a.string(),
  //   cheque: a.string(),
  //   deposit_ref: a.string(),   // bordereau
  //   bank_statement: a.string(),

  //   // payee_id: a.id(),
  //   product_id: a.id(),
  // })
  //   .authorization((allow) => [allow.publicApiKey()]),

  // Sale: a.model({
  //   season: a.string().required(),
  //   vendor: a.string().required(),
  //   date: a.date().required(),

  //   payer_id: a.id().required(),
  //   comment: a.string(),
  //   records: a.hasMany('Record', 'sale_id'),
  // })
  //   .authorization((allow) => [allow.publicApiKey()]),

  // Value: a.customType({
  //   value: a.float().required(),
  // }),

  Operation: a.customType({
    label: a.string().required(),
    amounts: a.json().required(),
    operation_type: a.string().required(),
  }),

  Financial: a.model({
    season: a.string().required(),
    date: a.date().required(),
    amounts: a.json().required(),
    operations: a.ref('Operation').array().required(),

    bank_label: a.string(),
    cheque_ref: a.string(),
    deposit_ref: a.string(),
    bank_report: a.string(),

  }).authorization((allow) => [allow.publicApiKey()]),


  Member: a.model({
    license_number: a.id().required(),
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
    games_credit: a.integer(),
    // payments: a.hasMany('Sale', 'payer_id'),
  })
    .authorization((allow) => [allow.publicApiKey()]),


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
    .authorization((allow) => [allow.publicApiKey()]),


  Page: a.model({
    link: a.string().required(),
    template: a.string(),
    rank: a.integer(),
    member_only: a.boolean(),
    menuId: a.id(),
    menu: a.belongsTo('Menu', 'menuId'),
    articles: a.hasMany('Article', 'pageId'),
  })
    .authorization((allow) => [allow.publicApiKey()]),


  Menu: a.model({
    label: a.string().required(),
    // summary: a.string(),
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
