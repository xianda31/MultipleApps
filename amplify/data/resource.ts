// @ts-nocheck - amplify backend file, compiled inadvertently by Angular due to Schema import chain
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
    productCodes:a.string()
  }),

  BookEntry: a.model({
    season: a.string().required(),
    date: a.date().required(),
    tag: a.string(),
    stripeTag: a.string(),      // Tag court Stripe (stripe:XXXXX) — lien de réconciliation avec StripeTransaction
    stripeSessionId: a.string(), // Stripe session ID complet (cs_xxx) — pour annulation BookEntry-first
    amounts: a.json().required(),
    operations: a.ref('Operation').array().required(),

    transaction_id: a.string().required(),
    cheque_ref: a.string(),
    deposit_ref: a.string(),
    bank_report: a.string(),
    invoice_ref: a.string(),
    // product_tag: a.string(), // pour faciliter le filtrage des ventes en compta (ex: "PAF Tournoi XYZ")

  })
    .authorization((allow) => [
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
    comment: a.string(),
    manual_creation: a.boolean(),
  })
    .authorization((allow) => [
      allow.guest().to(['read']),
      allow.group(Group_names.System).to(['read', 'create', 'update', 'delete']),
      allow.group(Group_names.Admin).to(['read','create', 'update', 'delete']),
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

  MemberGender: a.enum(['M', 'F', 'U']),


  Member: a.model({
    license_number: a.string().required(),
    email: a.string().required(),
    gender: a.ref('MemberGender'),
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
    person_id: a.integer(),
    iv: a.integer(),
    iv_code: a.string(),

  })
    .authorization((allow) => [
      allow.guest().to(['read']),
      allow.group(Group_names.System).to(['read', 'create', 'update', 'delete']),
      allow.group(Group_names.Admin).to(['read', 'create', 'update', 'delete']),
      allow.group(Group_names.Editor).to(['read', 'create', 'update']),
      allow.group(Group_names.Support).to(['read', 'create', 'update']),
      allow.group(Group_names.Member).to(['read', 'update']),

    ]),


  // Produits à la vente (unifié back-office + Stripe)

  SaleItem: a.model({
    id: a.id().required(),
    name: a.string().required(),          // label court (Stripe + back)
    productCode: a.string(),              // code produit interne (optionnel)
    description: a.string().required(),   // label long
    glyph: a.string().required(),         // icône UI back-office
    price: a.float().required(),          // en euros (source of truth — prix total de l'achat)
    account: a.string().required(),       // compte compta (ex: "CAR")
    paired: a.boolean().required(),       // produit couplé (paire de membres)
    currency: a.string().required(),      // "EUR" par défaut
    stripeEnabled: a.boolean().required(), // vendable en ligne
    active: a.boolean().required(),
    shopEnabled: a.boolean(),          // visible dans Shop (vente nominative adhérent)
    batchEnabled: a.boolean(),         // visible dans CollecteVente (vente en batch/événement)
  })
    .identifier(['id'])
    .authorization((allow) => [
      allow.guest().to(['read']),
      allow.group(Group_names.System).to(['read', 'create', 'update', 'delete']),
      allow.group(Group_names.Admin).to(['read', 'create', 'update', 'delete']),
      allow.group(Group_names.Editor).to(['read', 'create']),
      allow.group(Group_names.Support).to(['read', 'create']),
      allow.group(Group_names.Member).to(['read']),
    ]),

  TicketingReservationStatus: a.enum(['reserved', 'sold', 'cancelled']),
  TicketingPaymentMode: a.enum(['cash', 'cheque', 'card', 'other']),
  TicketingPaymentStatus: a.enum(['active', 'cancelled']),

  TicketingReservation: a.model({
    season: a.string().required(),
    date: a.date().required(),
    eventTitle: a.string().required(),
    reservationKey: a.string().required(),
    memberName: a.string().required(),
    isMember: a.boolean().required(),
    reservationStatus: a.ref('TicketingReservationStatus').required(),
    paidAmount: a.float(),
    paidAccount: a.string(),
    paidProductId: a.string(),
    paymentMode: a.ref('TicketingPaymentMode'),
    paymentId: a.string(),
    paidAt: a.datetime(),
    accountedAt: a.datetime(),
    source: a.string(),
  })
    .authorization((allow) => [
      allow.group(Group_names.System).to(['read', 'create', 'update', 'delete']),
      allow.group(Group_names.Admin).to(['read', 'create', 'update', 'delete']),
      allow.group(Group_names.Editor).to(['read', 'create', 'update', 'delete']),
      allow.group(Group_names.Support).to(['read', 'create', 'update', 'delete']),
      allow.group(Group_names.Member).to(['read']),
    ]),

  TicketingPayment: a.model({
    season: a.string().required(),
    date: a.date().required(),
    eventTitle: a.string().required(),
    status: a.ref('TicketingPaymentStatus').required(),
    paymentMode: a.ref('TicketingPaymentMode').required(),
    totalAmount: a.float().required(),
    reservationCount: a.integer().required(),
    accountedAt: a.datetime(),
  })
    .authorization((allow) => [
      allow.group(Group_names.System).to(['read', 'create', 'update', 'delete']),
      allow.group(Group_names.Admin).to(['read', 'create', 'update', 'delete']),
      allow.group(Group_names.Editor).to(['read', 'create', 'update', 'delete']),
      allow.group(Group_names.Support).to(['read', 'create', 'update', 'delete']),
      allow.group(Group_names.Member).to(['read']),
    ]),


  // Stripe Transactions (paiements par carte)
  StripeTransaction: a.model({
    id: a.id().required(),
    stripeSessionId: a.string().required(),  // Stripe Checkout session ID (cs_xxx)
    stripeTag: a.string(),                   // Tag court (stripe:XXXXX) — même valeur que BookEntry.stripeTag
    bookEntryId: a.string(),                 // ID du BookEntry associé (BookEntry-first)
    buyerMemberId: a.string(),               // DynamoDB Member ID de l'acheteur
    status: a.enum(['pending', 'completed', 'failed']),
    amountCents: a.integer().required(),
    currency: a.string().required(),
    customerEmail: a.string(),
    confirmationEmailSentAt: a.string(),
    confirmationEmailProcessingAt: a.string(),
    confirmationEmailError: a.string(),
    stripeMeta: a.json(),                    // season, date, memberName, amounts...
    processed: a.boolean(),                  // true après confirmation frontend
    amountFeesCents: a.integer(),            // frais Stripe prélevés (pour Phase 2 reconciliation)
    amountNetCents: a.integer(),             // montant net reçu = amountCents - amountFeesCents
    reconciledAt: a.string(),                // date/heure de la réconciliation avec payout Stripe
    payoutId: a.string(),                    // Stripe payout ID (pour tracer le virement bancaire)
    ttl: a.integer(),                        // TTL DynamoDB (epoch seconds) — purge auto après 3 ans
  })
    .identifier(['id'])
    .authorization((allow) => [
      allow.guest().to(['read']),
      allow.group(Group_names.System).to(['read', 'create', 'update', 'delete']),
      allow.group(Group_names.Admin).to(['read', 'create', 'update', 'delete']),
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
    extra_parameter: a.string(), // generic parameter value for plugins (url, filename, etc.)
    extra_parameter_label: a.string(), // key name for route.data (e.g. 'external_url', 'pdf_src')
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

    
  // Suivi des visites (analytics interne) - niveau session

  VisitSession: a.model({
    sessionId: a.string().required(),
    date: a.string().required(),
    yearMonth: a.string().required(),
    firstSeenAt: a.string().required(),
    lastSeenAt: a.string().required(),
    pageViewCount: a.integer().required(),
    authenticated: a.boolean().required(),
    memberId: a.string(),
    section: a.string().required(),
  })
    .identifier(['sessionId'])
    .authorization((allow) => [
      allow.guest().to(['read', 'create', 'update']),
      allow.group(Group_names.System).to(['read', 'create', 'update', 'delete']),
      allow.group(Group_names.Admin).to(['read', 'create', 'update', 'delete']),
      allow.group(Group_names.Editor).to(['read', 'create', 'update']),
      allow.group(Group_names.Support).to(['read', 'create', 'update']),
      allow.group(Group_names.Member).to(['read', 'create', 'update']),
    ]),

  // Suivi des visites (analytics interne) - agrégat journalier

  VisitDailyStat: a.model({
    date: a.string().required(),
    section: a.string().required(),
    yearMonth: a.string().required(),
    totalSessions: a.integer().required(),
    authenticatedSessions: a.integer().required(),
    anonymousSessions: a.integer().required(),
    pageViews: a.integer().required(),
  })
    .identifier(['date', 'section'])
    .authorization((allow) => [
      allow.guest().to(['read', 'create', 'update']),
      allow.group(Group_names.System).to(['read', 'create', 'update', 'delete']),
      allow.group(Group_names.Admin).to(['read', 'create', 'update', 'delete']),
      allow.group(Group_names.Editor).to(['read', 'create', 'update']),
      allow.group(Group_names.Support).to(['read', 'create', 'update']),
      allow.group(Group_names.Member).to(['read', 'create', 'update']),
    ]),


  // ── Sondages ─────────────────────────────────────────────────────────────

  Survey: a.model({
    title: a.string().required(),
    description: a.string(),
    footerNote: a.string(),
    surveyType: a.enum(['poll', 'rsvp', 'invitation']),  // 'poll' = QCM simple, 'rsvp' = RSVP, 'invitation' = sondage avec Question 0
    status: a.enum(['draft', 'active', 'closed']),
    closingDate: a.string().required(),
    productTag: a.string(),
  })
    .authorization((allow) => [
      allow.group(Group_names.System).to(['read', 'create', 'update', 'delete']),
      allow.group(Group_names.Admin).to(['read', 'create', 'update', 'delete']),
      allow.group(Group_names.Editor).to(['read', 'create', 'update', 'delete']),
      allow.group(Group_names.Support).to(['read', 'create', 'update', 'delete']),
      allow.group(Group_names.Member).to(['read', 'create', 'update', 'delete']),
    ]),

  SurveyQuestion: a.model({
    surveyId: a.string().required(),
    order: a.integer().required(),         // -1 = question d'invitation, 0+ = questions normales
    text: a.string().required(),
    options: a.string().array().required(),        // texte complet des choix
    optionKeywords: a.string().array(),            // mot-clef court affiché dans le tableau résultats
  })
    .authorization((allow) => [
      allow.group(Group_names.System).to(['read', 'create', 'update', 'delete']),
      allow.group(Group_names.Admin).to(['read', 'create', 'update', 'delete']),
      allow.group(Group_names.Editor).to(['read', 'create', 'update', 'delete']),
      allow.group(Group_names.Support).to(['read', 'create', 'update', 'delete']),
      allow.group(Group_names.Member).to(['read', 'create', 'update', 'delete']),
    ]),

  SurveyResponse: a.model({
    surveyId: a.string().required(),
    surveyTokenId: a.string(),           // token UUID associé (accès sans login)
    memberId: a.string().required(),     // license_number ou cognitoId
    memberEmail: a.string().required(),
    memberName: a.string(),              // prénom + nom pour le tableau admin
    answers: a.json().required(),        // { [questionId]: optionIndex }
    // poll: 'submitted' | rsvp: 'confirmed' | 'declined' | 'cancelled'
    status: a.string(),
    submittedAt: a.string(),             // ISO date de la dernière modification
  })
    .authorization((allow) => [
      allow.guest().to(['read', 'create', 'update', 'delete']),
      allow.group(Group_names.System).to(['read', 'create', 'update', 'delete']),
      allow.group(Group_names.Admin).to(['read', 'create', 'update', 'delete']),
      allow.group(Group_names.Editor).to(['read', 'create', 'update', 'delete']),
      allow.group(Group_names.Support).to(['read', 'create', 'update', 'delete']),
      allow.group(Group_names.Member).to(['read', 'create', 'update', 'delete']),
    ]),

  // Tokens pour accès mail sans login (UUID v4, validés côté Lambda)
  SurveyToken: a.model({
    token: a.string().required(),        // UUID v4 — clé primaire
    surveyId: a.string().required(),
    memberId: a.string().required(),
    memberEmail: a.string().required(),
    memberName: a.string(),
    expiresAt: a.string().required(),    // = closingDate du sondage
    lastActivityAt: a.string(),          // dernière action (vote, annulation, rétablissement)
  })
    .identifier(['token'])
    .authorization((allow) => [
      allow.group(Group_names.System).to(['read', 'create', 'update', 'delete']),
      allow.group(Group_names.Admin).to(['read', 'create', 'update', 'delete']),
      allow.group(Group_names.Editor).to(['read', 'create', 'update', 'delete']),
      allow.group(Group_names.Support).to(['read', 'create', 'update', 'delete']),
      allow.group(Group_names.Member).to(['read', 'create', 'update', 'delete']),
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
    allow.group(Group_names.Member).to(['read', 'create', 'update', 'delete']),
  ]),

  // ─── Paiement CB via ppTPE (conf A : PC → AppSync → ppTPE → WisePad 3) ───
  // PC crée le PaymentRequest (status: pending), ppTPE le reçoit via subscription,
  // exécute le paiement Terminal, puis met à jour le status.

  PaymentRequest: a.model({
    clientSecret: a.string().required(),     // Stripe PaymentIntent client_secret
    paymentIntentId: a.string().required(),  // Stripe pi_xxx
    amountCents: a.integer().required(),
    memberName: a.string().required(),
    season: a.string().required(),
    date: a.string().required(),
    bookEntryId: a.string(),                 // BookEntry à mettre à jour après paiement
    stripeTag: a.string(),                   // pour réconciliation
    status: a.enum(['pending', 'processing', 'success', 'failed', 'cancelled']),
    errorMessage: a.string(),                // message d'erreur si status=failed
    ttl: a.integer(),                        // purge auto DynamoDB (epoch seconds, ~24h)
  })
    .authorization((allow) => [
      allow.group(Group_names.System).to(['read', 'create', 'update', 'delete']),
      allow.group(Group_names.Admin).to(['read', 'create', 'update', 'delete']),
      allow.group(Group_names.Editor).to(['read', 'create', 'update']),
      allow.group(Group_names.Support).to(['read', 'create', 'update']),
    ]),
  // ─── État de connexion ppTPE (Android publie, PC souscrit) ───
  // ppTPE Android crée/met à jour cette entrée quand il connecte un reader.
  // Le PC souscrit via observeQuery pour afficher l'état réel en temps réel.
  TPESession: a.model({
    readerLabel: a.string(),         // ex: 'WisePad 3', 'Stripe Reader S700 Simulator'
    readerSerial: a.string(),        // serial du reader (identifiant unique)
    status: a.enum(['scanning', 'connected', 'disconnected']),
    ttl: a.integer(),                // purge auto DynamoDB (epoch seconds, ~24h)
  })
    .authorization((allow) => [
      allow.group(Group_names.System).to(['read', 'create', 'update', 'delete']),
      allow.group(Group_names.Admin).to(['read', 'create', 'update', 'delete']),
      allow.group(Group_names.Editor).to(['read', 'create', 'update']),
      allow.group(Group_names.Support).to(['read', 'create', 'update']),
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
