import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { last } from 'rxjs';
import { Payment } from '../../projects/cashier/src/app/cart/cart.interface';

const schema = a.schema({

  Product: a.model({
    glyph: a.string().required(),
    description: a.string().required(),
    category: a.string().required(),
    price: a.float().required(),
    // color: a.string(),
    paired: a.boolean().required(),
    active: a.boolean().required(),
  })
    .authorization((allow) => [allow.publicApiKey()]),

  Session: a.model({
    season: a.string().required(),
    creator: a.string().required(),
    event: a.datetime().required(),
    payments: a.hasMany('Payment', 'session_id'),
  })
    .authorization((allow) => [allow.publicApiKey()]),

  SaleItem: a.model({
    product_id: a.id().required(),
    payee_id: a.id().required(),
    price_payed: a.float().required(),
    payment_id: a.id().required(),
    payment: a.belongsTo('Payment', 'payment_id'),
  })
    .authorization((allow) => [allow.publicApiKey()]),

  Payment: a.model({
    amount: a.float().required(),
    session_id: a.id().required(),
    payer_id: a.id().required(),
    payer: a.belongsTo('Member', 'payer_id'),
    session: a.belongsTo('Session', 'session_id'),
    payment_mode: a.string().required(),
    bank: a.string(),
    cheque_no: a.string(),
    cross_checked: a.boolean(),
    saleItems: a.hasMany('SaleItem', 'payment_id'),
  })
    .authorization((allow) => [allow.publicApiKey()]),




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
    has_account: a.boolean(),
    payments: a.hasMany('Payment', 'payer_id'),
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
