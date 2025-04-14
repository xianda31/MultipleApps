import { FINANCIAL_ACCOUNT, BOOK_ENTRY_CLASS, ENTRY_TYPE, CUSTOMER_ACCOUNT, BALANCE_ACCOUNT } from './accounting.interface';


// choix de configuration Majeur !!!
// le dépôt de chèques peut se fait d'abord dans la caisse ou directement dans le compte bancaire ....
// si _CHEQUES_FIRST_IN_CASHBOX = true, les chèques sont d'abord déposés dans la caisse
// // puis tranferrés dans le compte bancaire => une transaction[ENTRY_TYPE.dépôt_caisse_chèques] est alors nécessaire
// sinon, ils sont directement déposés dans le compte bancaire [bank_in]
//
// choix :  _CHEQUES_FIRST_IN_CASHBOX = true;
//
export const _CHEQUES_FIRST_IN_CASHBOX: boolean = true;
export const _CHEQUE_IN_ACCOUNT: FINANCIAL_ACCOUNT = _CHEQUES_FIRST_IN_CASHBOX ? FINANCIAL_ACCOUNT.CASHBOX_debit : FINANCIAL_ACCOUNT.BANK_debit;
//
//


export type Account_def = {
  key: string //FINANCIAL_ACCOUNT | CUSTOMER_ACCOUNT | BALANCE_SHEET_ACCOUNT
  label: string
  description: string
}

export const financial_debits: Account_def[] = [
  { key: FINANCIAL_ACCOUNT.CASHBOX_debit, label: 'Caisse_in', description: ' ' },
  { key: FINANCIAL_ACCOUNT.BANK_debit, label: 'Banque_in', description: ' ' },
  { key: FINANCIAL_ACCOUNT.SAVING_debit, label: 'Epargne_in', description: ' ' },
]
export const financial_credits: Account_def[] = [
  { key: FINANCIAL_ACCOUNT.CASHBOX_credit, label: 'Caisse_out', description: ' ' },
  { key: FINANCIAL_ACCOUNT.BANK_credit, label: 'Banque_out', description: ' ' },
  { key: FINANCIAL_ACCOUNT.SAVING_credit, label: 'Epargne_out', description: ' ' },

]
export const customer_options: Account_def[] = [
  { key: CUSTOMER_ACCOUNT.ASSET_debit, label: '-AVOIR', description: 'déduction d\'un avoir' },
  { key: CUSTOMER_ACCOUNT.DEBT_credit, label: '+DETTE', description: 'remboursement d\'une dette' },
  { key: CUSTOMER_ACCOUNT.DEBT_debit, label: 'CREDIT', description: 'montant du"crédit"' },
]
export const customer_asset_credit: Account_def[] = [
  { key: CUSTOMER_ACCOUNT.ASSET_credit, label: 'AVOIR', description: 'attribution bon d\'achat' },
]

export const balance_sheet_accounts: Account_def[] = [
  { key: BALANCE_ACCOUNT.BAL_credit, label: 'BAL_credit', description: 'actif' },
  { key: BALANCE_ACCOUNT.BAL_debit, label: 'BAL_debit', description: 'report année N-1' },
]

export const Class_descriptions: { [key in BOOK_ENTRY_CLASS]: string } = {
  [BOOK_ENTRY_CLASS.REVENUE_FROM_MEMBER]: 'recette produit adhérent',
  [BOOK_ENTRY_CLASS.OTHER_EXPENSE]: 'toute dépense',
  [BOOK_ENTRY_CLASS.OTHER_REVENUE]: 'recette hors produit adhérent',
  [BOOK_ENTRY_CLASS.EXPENSE_FOR_MEMBER]: 'dépense pour adhérent',
  [BOOK_ENTRY_CLASS.MOVEMENT]: 'mouvement bancaire',
  [BOOK_ENTRY_CLASS.BALANCE]: 'spécifique bilan',
}

export type Transaction = {
  class: BOOK_ENTRY_CLASS,
  label: string,
  financial_accounts: Account_def[],
  optional_accounts?: Account_def[],
  financial_accounts_to_charge: Array<FINANCIAL_ACCOUNT | CUSTOMER_ACCOUNT | BALANCE_ACCOUNT>,
  nominative: boolean,
  pure_financial: boolean,
  is_of_profit_type: boolean,
  require_deposit_ref: boolean,
  cash: 'in' | 'out' | 'none',
  cheque: 'in' | 'out' | 'none'
};

export const TRANSACTIONS: { [key in ENTRY_TYPE]: Transaction } = {

  // A.  vente à  adhérent ****
  // ****  CLASS = REVENUE_FROM_MEMBER ****

  // paiement en espèces par un adhérent
  [ENTRY_TYPE.achat_adhérent_en_espèces]: {
    label: 'paiement en espèces',
    class: BOOK_ENTRY_CLASS.REVENUE_FROM_MEMBER,
    financial_accounts: financial_debits,
    optional_accounts: customer_options,
    financial_accounts_to_charge: [FINANCIAL_ACCOUNT.CASHBOX_debit],
    nominative: true,
    pure_financial: false,
    is_of_profit_type: true,
    require_deposit_ref: false,
    cash: 'in',
    cheque: 'none',
  },
  // paiement par chèque par un adhérent
  [ENTRY_TYPE.achat_adhérent_par_chèque]: {
    label: 'paiement par chèque',
    class: BOOK_ENTRY_CLASS.REVENUE_FROM_MEMBER,
    financial_accounts: financial_debits,
    optional_accounts: customer_options,
    financial_accounts_to_charge: _CHEQUES_FIRST_IN_CASHBOX ? [FINANCIAL_ACCOUNT.CASHBOX_debit] : [FINANCIAL_ACCOUNT.BANK_debit],
    nominative: true,
    pure_financial: false,
    is_of_profit_type: true,
    require_deposit_ref: false,
    cash: 'none',
    cheque: 'in',
  },
  // vente à crédit (créance) à un adhérent
  // [ENTRY_TYPE.payment_on_credit]: {
  //   label: 'paiement à \"crédit\"',
  //   class: BOOK_ENTRY_CLASS.REVENUE_FROM_MEMBER,
  //   financial_accounts: financial_debits,
  //   optional_accounts: customer_debt,
  //   financial_accounts_to_charge: [CUSTOMER_ACCOUNT.DEBT_debit],
  //   nominative: true,
  //   pure_financial: false,
  //   is_of_profit_type: true,
  //   require_deposit_ref: false,
  //   cash: 'none',
  //   cheque: 'none',
  // },
  // paiement par virement d'un adhérent
  [ENTRY_TYPE.achat_adhérent_par_virement]: {
    label: 'VIREMENT EN NOTRE FAVEUR',
    class: BOOK_ENTRY_CLASS.REVENUE_FROM_MEMBER,
    financial_accounts: financial_debits,
    optional_accounts: customer_options,
    financial_accounts_to_charge: [FINANCIAL_ACCOUNT.BANK_debit],
    nominative: true,
    pure_financial: false,
    is_of_profit_type: true,
    require_deposit_ref: false,
    cash: 'none',
    cheque: 'none',
  },

  //B.  vente unitaire à tiers ****
  // ****  CLASS = OTHER_REVENUE ****

  // reception d'espèces de la par d'autres qu'un adhérent
  [ENTRY_TYPE.vente_en_espèces]: {
    label: 'paiement en espèces',
    class: BOOK_ENTRY_CLASS.OTHER_REVENUE,
    financial_accounts: financial_debits,
    financial_accounts_to_charge: [FINANCIAL_ACCOUNT.CASHBOX_debit],
    nominative: false,
    pure_financial: false,
    is_of_profit_type: true,
    require_deposit_ref: false,
    cash: 'in',
    cheque: 'none',
  },

  // réception de chèque(s) de la par d'autres qu'un adhérent
  [ENTRY_TYPE.vente_par_chèque]: {
    label: 'paiement par chèque',
    class: BOOK_ENTRY_CLASS.OTHER_REVENUE,
    financial_accounts: financial_debits,
    financial_accounts_to_charge: _CHEQUES_FIRST_IN_CASHBOX ? [FINANCIAL_ACCOUNT.CASHBOX_debit] : [FINANCIAL_ACCOUNT.BANK_debit],
    nominative: false,
    pure_financial: false,
    is_of_profit_type: true,
    require_deposit_ref: false,
    cash: 'none',
    cheque: 'in',
  },
  [ENTRY_TYPE.vente_par_virement]: {
    label: 'VIREMENT EN NOTRE FAVEUR',
    class: BOOK_ENTRY_CLASS.OTHER_REVENUE,
    financial_accounts: financial_debits,
    financial_accounts_to_charge: [FINANCIAL_ACCOUNT.BANK_debit],
    nominative: false,
    pure_financial: false,
    is_of_profit_type: true,
    require_deposit_ref: false,
    cash: 'none',
    cheque: 'none',
  },

  // C. reception groupée de fond de tiers  ****
  // ****  CLASS = OTHER_REVENUE ****

  // dépot de fonds en espèces
  [ENTRY_TYPE.dépôt_collecte_espèces]: {
    label: 'VERSEMENT D\'ESPÈCES',
    class: BOOK_ENTRY_CLASS.OTHER_REVENUE,
    financial_accounts: financial_debits,
    financial_accounts_to_charge: [FINANCIAL_ACCOUNT.BANK_debit],
    nominative: false,
    pure_financial: false,
    is_of_profit_type: true,
    require_deposit_ref: true,
    cash: 'none',
    cheque: 'none',
  },

  // virement en notre faveur reçu d'une autre entité
  // dépot de fonds en chèques (non tracés)
  [ENTRY_TYPE.dépôt_collecte_chèques]: {
    label: 'REMISE DE CHÈQUES',
    class: BOOK_ENTRY_CLASS.OTHER_REVENUE,
    financial_accounts: financial_debits,
    financial_accounts_to_charge: [FINANCIAL_ACCOUNT.BANK_debit],
    nominative: false,
    pure_financial: false,
    is_of_profit_type: true,
    require_deposit_ref: true,
    cash: 'none',
    cheque: 'none',
  },
    // interet de l'épargne
    [ENTRY_TYPE.intérêt_épargne]: {
      label: 'INTERÊT D\'ÉPARGNE',
      class: BOOK_ENTRY_CLASS.OTHER_REVENUE,
      financial_accounts: financial_debits,
      financial_accounts_to_charge: [FINANCIAL_ACCOUNT.SAVING_debit],
      nominative: false,
      pure_financial: false,
      is_of_profit_type: true,
      require_deposit_ref: false,
      cash: 'none',
      cheque: 'none',
    },

  // D.  mouvements de fonds ****
  // ****  CLASS = MOVEMENT ****

  // dépot d'espèces (de la caisse) en banque
  [ENTRY_TYPE.dépôt_caisse_espèces]: {
    label: 'VERSEMENT D\'ESPÈCES',
    class: BOOK_ENTRY_CLASS.MOVEMENT,
    financial_accounts: [...financial_credits, ...financial_debits],
    financial_accounts_to_charge: [FINANCIAL_ACCOUNT.CASHBOX_credit, FINANCIAL_ACCOUNT.BANK_debit],
    nominative: false,
    pure_financial: true,
    is_of_profit_type: false,
    require_deposit_ref: false,
    cash: 'out',
    cheque: 'none',
  },
  // dépot de chèques (receptionnés en caisse) en banque
  [ENTRY_TYPE.dépôt_caisse_chèques]: {
    label: 'REMISE DE CHÈQUES',
    class: BOOK_ENTRY_CLASS.MOVEMENT,
    financial_accounts: [...financial_credits, ...financial_debits],
    // profit_and_loss_accounts: FINANCIAL_ACCOUNT.BANK_debit,
    financial_accounts_to_charge: [FINANCIAL_ACCOUNT.CASHBOX_credit, FINANCIAL_ACCOUNT.BANK_debit],
    nominative: false,
    pure_financial: true,
    is_of_profit_type: false,
    require_deposit_ref: true,
    cash: 'none',
    cheque: 'none',
  },
  // versement sur compte épargne
  [ENTRY_TYPE.virement_banque_vers_épargne]: {
    label: 'VERSEMENT SUR COMPTE ÉPARGNE',
    class: BOOK_ENTRY_CLASS.MOVEMENT,
    financial_accounts: [...financial_credits, ...financial_debits],
    // profit_and_loss_accounts: FINANCIAL_ACCOUNT.SAVING_debit,
    financial_accounts_to_charge: [FINANCIAL_ACCOUNT.BANK_credit, FINANCIAL_ACCOUNT.SAVING_debit],
    nominative: false,
    pure_financial: true,
    is_of_profit_type: false,
    require_deposit_ref: false,
    cash: 'none',
    cheque: 'none',
  },
  // retrait du compte épargne
  [ENTRY_TYPE.retrait_épargne_vers_banque]: {
    label: 'RETRAIT DU COMPTE ÉPARGNE',
    class: BOOK_ENTRY_CLASS.MOVEMENT,
    // profit_and_loss_accounts: FINANCIAL_ACCOUNT.BANK_debit,
    financial_accounts: [...financial_credits, ...financial_debits],
    financial_accounts_to_charge: [FINANCIAL_ACCOUNT.BANK_debit, FINANCIAL_ACCOUNT.SAVING_credit],
    nominative: false,
    pure_financial: true,
    is_of_profit_type: false,
    require_deposit_ref: false,
    cash: 'none',
    cheque: 'none',
  },



  // E depense pour adhérent ****
  // ****  CLASS = EXPENS_FOR_MEMBER ****

  // émission d'avoir à un adhérent
  [ENTRY_TYPE.dépense_en_avoir]: {
    label: 'attribution d\'avoir(s) nominatif(s)',
    class: BOOK_ENTRY_CLASS.EXPENSE_FOR_MEMBER,
    financial_accounts: [],
    optional_accounts: customer_asset_credit,
    financial_accounts_to_charge: [CUSTOMER_ACCOUNT.ASSET_credit],
    nominative: true,
    pure_financial: false,
    is_of_profit_type: false,
    require_deposit_ref: false,
    cash: 'none',
    cheque: 'none',
  },

 // F. achat , dépenses
  // ****  CLASS = EXPENSE ****

  // achat en espèces d'une prestation ou service
  [ENTRY_TYPE.dépense_en_espèces]: {
    label: 'achat en espèces',
    class: BOOK_ENTRY_CLASS.OTHER_EXPENSE,
    financial_accounts: financial_credits,
    financial_accounts_to_charge: [FINANCIAL_ACCOUNT.CASHBOX_credit],
    nominative: false,
    pure_financial: false,
    is_of_profit_type: false,
    require_deposit_ref: false,
    cash: 'out',
    cheque: 'none',
  },

  // paiement par chèque d'une prestation ou service
  [ENTRY_TYPE.dépense_par_chèque]: {
    label: 'CHEQUE EMIS',
    class: BOOK_ENTRY_CLASS.OTHER_EXPENSE,
    financial_accounts: financial_credits,
    financial_accounts_to_charge: [FINANCIAL_ACCOUNT.BANK_credit],
    // optional_accounts: balance_sheet_accounts,
    nominative: false,
    pure_financial: false,
    is_of_profit_type: false,
    require_deposit_ref: false,
    cash: 'none',
    cheque: 'out',
  },
  // paiement à un tiers d'une prestation ou service par virement
  [ENTRY_TYPE.dépense_par_virement]: {
    label: 'VIREMENT EMIS',
    class: BOOK_ENTRY_CLASS.OTHER_EXPENSE,
    financial_accounts: financial_credits,
    financial_accounts_to_charge: [FINANCIAL_ACCOUNT.BANK_credit],
    nominative: false,
    pure_financial: false,
    is_of_profit_type: false,
    require_deposit_ref: false,
    cash: 'none',
    cheque: 'none',
  },
  // paiement par carte bancaire d'une prestation ou de marchandises
  [ENTRY_TYPE.dépense_par_carte]: {
    label: 'PAIEMENT PAR CARTE',
    class: BOOK_ENTRY_CLASS.OTHER_EXPENSE,
    financial_accounts: financial_credits,
    financial_accounts_to_charge: [FINANCIAL_ACCOUNT.BANK_credit],
    nominative: false,
    pure_financial: false,
    is_of_profit_type: false,
    require_deposit_ref: false,
    cash: 'none',
    cheque: 'none',
  },
  // prélèvement sur le compte bancaire par une autre entité
  [ENTRY_TYPE.dépense_par_prélèvement]: {
    label: 'PRÉLÈVEMENT',
    class: BOOK_ENTRY_CLASS.OTHER_EXPENSE,
    financial_accounts: financial_credits,
    financial_accounts_to_charge: [FINANCIAL_ACCOUNT.BANK_credit],
    nominative: false,
    pure_financial: false,
    is_of_profit_type: false,
    require_deposit_ref: false,
    cash: 'none',
    cheque: 'none',
  },

  // G. opérations spécifiques bilan
  // ****  CLASS = BALANCE_SHEET ****

  [ENTRY_TYPE.report_avoir]: {
    label: 'report d\'avoir',
    class: BOOK_ENTRY_CLASS.BALANCE,
    financial_accounts: [{ key: BALANCE_ACCOUNT.BAL_debit, label: 'report_in', description: 'passif' }],
    optional_accounts: [{ key: CUSTOMER_ACCOUNT.ASSET_credit, label: 'Avoir', description: 'valeur de l\'avoir attribué' }],
    financial_accounts_to_charge: [CUSTOMER_ACCOUNT.ASSET_credit],
    nominative: true,
    pure_financial: false,
    is_of_profit_type: false,
    require_deposit_ref: false,
    cash: 'none',
    cheque: 'none',
  },
  // report d'encours paiement par chèque d'une prestation ou service
  [ENTRY_TYPE.report_chèque]: {
    label: 'report de chèque',
    class: BOOK_ENTRY_CLASS.BALANCE,
    financial_accounts: [...balance_sheet_accounts, ...financial_credits],
    financial_accounts_to_charge: [BALANCE_ACCOUNT.BAL_debit, FINANCIAL_ACCOUNT.BANK_credit],
    // optional_accounts: balance_sheet_accounts,
    nominative: false,
    pure_financial: true,
    is_of_profit_type: false,
    require_deposit_ref: false,
    cash: 'none',
    cheque: 'out',
  },
  [ENTRY_TYPE.report_dette]: {
    label: 'report de dette',
    class: BOOK_ENTRY_CLASS.BALANCE,
    financial_accounts: [...balance_sheet_accounts, ...financial_credits],
    financial_accounts_to_charge: [BALANCE_ACCOUNT.BAL_debit, CUSTOMER_ACCOUNT.DEBT_credit],
    // optional_accounts: balance_sheet_accounts,
    nominative: true,
    pure_financial: true,
    is_of_profit_type: false,
    require_deposit_ref: false,
    cash: 'none',
    cheque: 'none',
  },

 


}



// export function class_to_types(op_class: BOOK_ENTRY_CLASS): ENTRY_TYPE[] {
//   let check = Object.values(BOOK_ENTRY_CLASS).includes(op_class);
//   if (check) {
//     return Object.entries(TRANSACTIONS)
//       .filter(([key, transaction]) => transaction.class === op_class)
//       .map(([key, transaction]) => key as ENTRY_TYPE);
//   } else {
//     console.log('%s n\'est pas une clef de %s', op_class, JSON.stringify(Object.entries(BOOK_ENTRY_CLASS)));
//     throw new Error(`class ${op_class} not found`);
//   }
// }

// export function get_transaction(entry_type: ENTRY_TYPE): Transaction {
//   let check = Object.keys(TRANSACTIONS).includes(entry_type);
//   if (check) {
//     return TRANSACTIONS[entry_type];
//   } else {
//     throw new Error(`transaction ${entry_type} not found`);
//   }
// }
