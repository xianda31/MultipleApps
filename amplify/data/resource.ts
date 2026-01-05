import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { addUserToGroup } from './add-user-to-group/resource';
import { listUsersInGroup } from './list-users-in-group/resource';
import { removeUserFromGroup } from './remove-user-from-group/resource';


// import { Group_names } from '../../projects/admin/src/app/common/authentification/group.interface';
enum Group_names {
  System = 'Systeme',
  Admin = 'Administrateur',
  Editor = 'Editeur',
  Support = 'Contributeur',
  Member = 'Membre'
}



const schema = a.schema({

  // custom mutation

  addUserToGroup: a
    .mutation()
    .arguments({
      userId: a.string().required(),
      groupName: a.string().required(),
    })
    .authorization((allow) => [
      allow.group(Group_names.System),
      allow.group(Group_names.Admin),
    ])
    .handler(a.handler.function(addUserToGroup))
    .returns(a.json()),

  removeUserFromGroup: a
    .mutation()
    .arguments({
      userId: a.string().required(),
      groupName: a.string().required(),
    })
    .authorization((allow) => [
      allow.group(Group_names.System),
      allow.group(Group_names.Admin),
    ])
    .handler(a.handler.function(removeUserFromGroup))
    .returns(a.json()),

  listUsersInGroup: a
    .mutation()
    .arguments({
      groupName: a.string().required(),
    })
    .authorization((allow) => [
      allow.group(Group_names.System),
      allow.group(Group_names.Admin),
      allow.group(Group_names.Editor),
      allow.group(Group_names.Support),
    ])
    .handler(a.handler.function(listUsersInGroup))
    .returns(a.json()),





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
      allow.group(Group_names.System).to(['read', 'create', 'update', 'delete']),
      allow.group(Group_names.Admin).to(['read', 'create', 'update']),
      allow.group(Group_names.Editor).to(['read', 'create']),
      allow.group(Group_names.Support).to(['read', 'create']),
      allow.group(Group_names.Member).to(['read']),

    ]),

  // carnet de parties 

  PlayBook: a.model({
    id: a.id().required(),
    initial_qty: a.integer().required(),
    licenses: a.string().array().required(),
    stamps: a.string().array().required(),
  })
    .authorization((allow) => [
      allow.guest().to(['read']),
      allow.group(Group_names.System).to(['read', 'create', 'update', 'delete']),
      allow.group(Group_names.Admin).to(['read', 'update', 'delete']),
      allow.group(Group_names.Editor).to(['read','create', 'update']),
      allow.group(Group_names.Support).to(['read','create', 'update']),
      allow.group(Group_names.Member).to(['read']),

    ]),



  // tournois joués


  Game: a.model({
    gameId: a.id().required(),
    season: a.string().required(),
    fee_rate: a.string().required(),
    member_trn_price: a.float().required(),
    non_member_trn_price: a.float().required(),
    fees_doubled: a.boolean().required(),
    alphabetic_sort: a.boolean().required(),
    tournament: a.customType({
      id: a.integer().required(),
      name: a.string().required(),
      date: a.string().required(),
      time: a.string().required()
    }),
    gamers: a.json().required(),
  })
    .identifier(['gameId'])
    .authorization((allow) => [
      allow.guest().to(['read']),
      allow.group(Group_names.System).to(['read', 'create', 'update', 'delete']),
      allow.group(Group_names.Admin).to(['read', 'create', 'update', 'delete']),
      allow.group(Group_names.Editor).to(['read', 'create', 'update']),
      allow.group(Group_names.Support).to(['read', 'create', 'update']),
      allow.group(Group_names.Member).to(['read']),


    ]),

  // Adhérents et personal data


  Member: a.model({
    license_number: a.string().required(),
    email: a.string().required(),
    gender: a.string(),
    firstname: a.string(),
    lastname: a.string(),
    birthdate: a.string(),
    city: a.string(),
    season: a.string(),
    phone_one: a.string(),
    orga_license_name: a.string(),
    is_sympathisant: a.boolean(),
    license_status: a.string(),
    license_taken_at: a.string(),
    register_date: a.string(),
    has_avatar: a.boolean(),
    accept_mailing: a.boolean(),
    membership_date: a.string(),


  })
    .authorization((allow) => [
      allow.guest().to(['read']),
      allow.group(Group_names.System).to(['read', 'create', 'update', 'delete']),
      allow.group(Group_names.Admin).to(['read', 'create', 'update', 'delete']),
      allow.group(Group_names.Editor).to(['read', 'create', 'update']),
      allow.group(Group_names.Support).to(['read', 'create', 'update']),
      allow.group(Group_names.Member).to(['read', 'update']),

    ]),


  // Produits à la vente

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
      allow.group(Group_names.System).to(['read', 'create', 'update', 'delete']),
      allow.group(Group_names.Admin).to(['read', 'create', 'update', 'delete']),
      allow.group(Group_names.Editor).to(['read', 'create']),
      allow.group(Group_names.Support).to(['read', 'create']),
      allow.group(Group_names.Member).to(['read']),

    ]),

  // Site web


  Snippet: a.model({
    title: a.string().required(),
    subtitle: a.string().required(),
    content: a.string().required(),
    public: a.boolean().required(),
    featured: a.boolean(),
    image: a.string(),
    file: a.string(),
    folder: a.string(),
    publishedAt: a.string(),
  })
    .authorization((allow) => [
      allow.guest().to(['read']),
      allow.group(Group_names.System).to(['read', 'create', 'update', 'delete']),
      allow.group(Group_names.Admin).to(['read', 'create', 'update', 'delete']),
      allow.group(Group_names.Editor).to(['read', 'create', 'update', 'delete']),
      allow.group(Group_names.Support).to(['read']),
      allow.group(Group_names.Member).to(['read']),

    ]),


  Page: a.model({
    id: a.id().required(),
    title: a.string().required(),
    template: a.string().required(),
    snippet_ids: a.string().array().required(),
  })
    .identifier(['id'])
    .authorization((allow) => [
      allow.guest().to(['read']),
      allow.group(Group_names.System).to(['read', 'create', 'update', 'delete']),
      allow.group(Group_names.Admin).to(['read', 'create', 'update', 'delete']),
      allow.group(Group_names.Editor).to(['read', 'create', 'update', 'delete']),
      allow.group(Group_names.Support).to(['read']),
      allow.group(Group_names.Member).to(['read']),

    ]),



  NavItem: a.model({
    sandbox: a.boolean().required(),
    type: a.string().required(),
    label:a.string().required(),
    slug: a.string().required(),
    path: a.string().required(),
    rank: a.integer().required(),
    logging_criteria: a.string().required(),
    group_level: a.integer().required(),
    position: a.enum(['Navbar', 'Footer', 'Brand']),
    // optional params
    pre_label: a.string(),
    parent_id: a.string(),
    page_id: a.string(),
    page_title: a.string(),
    external_url: a.string(),
    plugin_name: a.string(),
  })
    .authorization((allow) => [
      allow.guest().to(['read']),
      allow.group(Group_names.System).to(['read', 'create', 'update', 'delete']),
      allow.group(Group_names.Admin).to(['read', 'create', 'update', 'delete']),
      allow.group(Group_names.Editor).to(['read', 'create', 'update', 'delete']),
      allow.group(Group_names.Support).to(['read']),
      allow.group(Group_names.Member).to(['read']),

    ]),

    
    // Assistance requests

AssistanceRequest: a.model({
  nom: a.string().required(),
  prenom: a.string().required(),
  email: a.string().required(),
  type: a.string().required(),
  texte: a.string().required(),
  status: a.string().required(),
})
.authorization((allow) => [
  allow.guest().to(['create']),
  allow.group(Group_names.System).to(['read', 'create', 'update', 'delete']),
    allow.group(Group_names.Admin).to(['read', 'create', 'update', 'delete']),
    allow.group(Group_names.Editor).to(['read', 'create', 'update', 'delete']),
    allow.group(Group_names.Support).to(['read', 'create', 'update', 'delete']),
    allow.group(Group_names.Member).to(['read', 'create']),
  ]),
  
});
export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
    // apiKeyAuthorizationMode: { expiresInDays: 30 }
  },
  // apiKeyAuthorizationMode: { expiresInDays: 2}
});
