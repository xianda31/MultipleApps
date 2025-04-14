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

    // class: a.string().required(),
    transaction_id: a.string().required(),
    cheque_ref: a.string(),
    deposit_ref: a.string(),
    bank_report: a.string(),

  }).authorization((allow) => [allow.publicApiKey()]),

  // Adhérents et produits Club

  Game_credit: a.customType({
    tag: a.string().required(),
    amount: a.integer().required(),
  }),

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
    game_credits: a.ref('Game_credit').array(),
  })
    .authorization((allow) => [allow.publicApiKey()]),

  Product: a.model({
    glyph: a.string().required(),
    description: a.string().required(),
    account: a.string().required(),
    price: a.float().required(),
    paired: a.boolean().required(),
    active: a.boolean().required(),
  })
    .authorization((allow) => [allow.publicApiKey()]),

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
