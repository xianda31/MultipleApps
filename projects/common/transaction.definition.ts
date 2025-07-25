import { FINANCIAL_ACCOUNT,  TRANSACTION_ID, CUSTOMER_ACCOUNT, BALANCE_ACCOUNT } from './accounting.interface';


// choix de configuration Majeur !!!
// le dépôt de chèques peut se fait d'abord dans la caisse ou directement dans le compte bancaire ....
// si _CHEQUES_FIRST_IN_CASHBOX = true, les chèques sont d'abord déposés dans la caisse
// // puis tranferrés dans le compte bancaire => une transaction[TRANSACTION_ID.dépôt_caisse_chèques] est alors nécessaire
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

// ordre des rubriques (dans l'éditeur) régi par l'ordre alphabétique
export enum TRANSACTION_CLASS {
  REVENUE_FROM_MEMBER = 'recette produit adhérent',
  OTHER_REVENUE = 'recette hors produit adhérent',
  EXPENSE_FOR_MEMBER = 'dépense pour adhérent',
  REIMBURSEMENT = 'remboursement adhérent',
  OTHER_EXPENSE = 'dépense générale',
  MOVEMENT = 'mouvement bancaire',
  BALANCE = 'spécifique bilan',
}

export type Transaction = {
  class: TRANSACTION_CLASS,
  label: string,
  tooltip:string,
  financial_accounts: Account_def[],
  optional_accounts?: Account_def[],
  financial_accounts_to_charge: Array<FINANCIAL_ACCOUNT | CUSTOMER_ACCOUNT | BALANCE_ACCOUNT>,
  nominative: boolean,
  pure_financial: boolean,
  revenue_account_to_show: boolean,
  require_deposit_ref: boolean,
  cash: 'in' | 'out' | 'none',
  cheque: 'in' | 'out' | 'none'
};

export const TRANSACTION_DIRECTORY: { [key in TRANSACTION_ID]: Transaction } = {


  // A.  vente à  adhérent ****
  // ****  CLASS = REVENUE_FROM_MEMBER ****

  // paiement en espèces par un adhérent
  [TRANSACTION_ID.achat_adhérent_en_espèces]: {
    label: 'paiement en espèces',
    tooltip: 'espèces d\'un adhérent reçues en caisse',
    class: TRANSACTION_CLASS.REVENUE_FROM_MEMBER,
    financial_accounts: financial_debits,
    optional_accounts: customer_options,
    financial_accounts_to_charge: [FINANCIAL_ACCOUNT.CASHBOX_debit],
    nominative: true,
    pure_financial: false,
    revenue_account_to_show: true,
    require_deposit_ref: false,
    cash: 'in',
    cheque: 'none',
  },
  // paiement par chèque par un adhérent
  [TRANSACTION_ID.achat_adhérent_par_chèque]: {
    label: 'paiement par chèque',
    tooltip: 'chèque d\'un adhérent reçu en caisse',
    class: TRANSACTION_CLASS.REVENUE_FROM_MEMBER,
    financial_accounts: financial_debits,
    optional_accounts: customer_options,
    financial_accounts_to_charge: _CHEQUES_FIRST_IN_CASHBOX ? [FINANCIAL_ACCOUNT.CASHBOX_debit] : [FINANCIAL_ACCOUNT.BANK_debit],
    nominative: true,
    pure_financial: false,
    revenue_account_to_show: true,
    require_deposit_ref: true,
    cash: 'none',
    cheque: 'in',
  },
  // paiement par virement d'un adhérent
  [TRANSACTION_ID.achat_adhérent_par_virement]: {
    label: 'VIREMENT EN NOTRE FAVEUR',
    tooltip: 'virement d\'un adhérent sur compte association',
    class: TRANSACTION_CLASS.REVENUE_FROM_MEMBER,
    financial_accounts: financial_debits,
    optional_accounts: customer_options,
    financial_accounts_to_charge: [FINANCIAL_ACCOUNT.BANK_debit],
    nominative: true,
    pure_financial: false,
    revenue_account_to_show: true,
    require_deposit_ref: false,
    cash: 'none',
    cheque: 'none',
  },

  //B.  vente unitaire à tiers ****
  // ****  CLASS = OTHER_REVENUE ****

  // reception d'espèces de la par d'autres qu'un adhérent
  [TRANSACTION_ID.vente_en_espèces]: {
    label: 'paiement en espèces',
    tooltip: 'espèces d\'un tiers reçues en caisse (rare !)',
    class: TRANSACTION_CLASS.OTHER_REVENUE,
    financial_accounts: financial_debits,
    financial_accounts_to_charge: [FINANCIAL_ACCOUNT.CASHBOX_debit],
    nominative: false,
    pure_financial: false,
    revenue_account_to_show: true,
    require_deposit_ref: false,
    cash: 'in',
    cheque: 'none',
  },

  // réception de chèque(s) de la par d'autres qu'un adhérent
  [TRANSACTION_ID.vente_par_chèque]: {
    label: 'paiement par chèque',
    tooltip: 'chèque d\'un tiers reçu en caisse (rare !)',
    class: TRANSACTION_CLASS.OTHER_REVENUE,
    financial_accounts: financial_debits,
    financial_accounts_to_charge: _CHEQUES_FIRST_IN_CASHBOX ? [FINANCIAL_ACCOUNT.CASHBOX_debit] : [FINANCIAL_ACCOUNT.BANK_debit],
    nominative: false,
    pure_financial: false,
    revenue_account_to_show: true,
    require_deposit_ref: true,
    cash: 'none',
    cheque: 'in',
  },
  [TRANSACTION_ID.vente_par_virement]: {
    label: 'VIREMENT EN NOTRE FAVEUR',
    tooltip: 'virement d\'un tiers sur compte association',
    class: TRANSACTION_CLASS.OTHER_REVENUE,
    financial_accounts: financial_debits,
    financial_accounts_to_charge: [FINANCIAL_ACCOUNT.BANK_debit],
    nominative: false,
    pure_financial: false,
    revenue_account_to_show: true,
    require_deposit_ref: false,
    cash: 'none',
    cheque: 'none',
  },
  //   [TRANSACTION_ID.debit_avoir]: {
  //   label: 'DEBIT D\'UN AVOIR',
  //   tooltip: 'débit d\'un avoir',
  //   class: TRANSACTION_CLASS.OTHER_REVENUE,
  //   financial_accounts: financial_debits,
  //   financial_accounts_to_charge: [CUSTOMER_ACCOUNT.ASSET_debit],
  //   nominative: false,
  //   pure_financial: false,
  //   revenue_account_to_show: true,
  //   require_deposit_ref: false,
  //   cash: 'none',
  //   cheque: 'none',
  // },

  // C. reception groupée de fond de tiers  ****
  // ****  CLASS = OTHER_REVENUE ****

  // dépot de fonds en espèces
  [TRANSACTION_ID.dépôt_collecte_espèces]: {
    label: 'VERSEMENT D\'ESPÈCES',
    tooltip: 'collecte d\'espèces directement déposé en banque',
    class: TRANSACTION_CLASS.OTHER_REVENUE,
    financial_accounts: [{ key: FINANCIAL_ACCOUNT.BANK_debit, label: 'Banque_in', description: '' }],
    financial_accounts_to_charge: [FINANCIAL_ACCOUNT.BANK_debit],
    nominative: false,
    pure_financial: false,
    revenue_account_to_show: true,
    require_deposit_ref: false, // was true ... to be checked
    cash: 'none',
    cheque: 'none',
  },

  // dépot de fonds en chèques (non tracés)
  [TRANSACTION_ID.dépôt_collecte_chèques]: {
    label: 'REMISE DE CHÈQUES',
    tooltip: 'collecte de chèques directement déposé en banque',
    class: TRANSACTION_CLASS.OTHER_REVENUE,
    financial_accounts: financial_debits,
    financial_accounts_to_charge: [FINANCIAL_ACCOUNT.BANK_debit],
    nominative: false,
    pure_financial: false,
    revenue_account_to_show: true,
    require_deposit_ref: true,
    cash: 'none',
    cheque: 'none',
  },
    // interet de l'épargne
    [TRANSACTION_ID.intérêt_épargne]: {
      label: 'INTERÊT D\'ÉPARGNE',
      tooltip: 'versement d\'intérêt de l\'épargne',
      class: TRANSACTION_CLASS.OTHER_REVENUE,
      financial_accounts: financial_debits,
      financial_accounts_to_charge: [FINANCIAL_ACCOUNT.SAVING_debit],
      nominative: false,
      pure_financial: false,
      revenue_account_to_show: true,
      require_deposit_ref: false,
      cash: 'none',
      cheque: 'none',
    },

  // D.  mouvements de fonds ****
  // ****  CLASS = MOVEMENT ****

  // dépot d'espèces (de la caisse) en banque
  [TRANSACTION_ID.dépôt_caisse_espèces]: {
    label: 'VERSEMENT D\'ESPÈCES',
    tooltip: 'retrait d\'espèces de la caisse vers le compte bancaire',
    class: TRANSACTION_CLASS.MOVEMENT,
    financial_accounts: [...financial_credits, ...financial_debits],
    financial_accounts_to_charge: [FINANCIAL_ACCOUNT.CASHBOX_credit, FINANCIAL_ACCOUNT.BANK_debit],
    nominative: false,
    pure_financial: true,
    revenue_account_to_show: false,
    require_deposit_ref: true,
    cash: 'out',
    cheque: 'none',
  },
  // dépot de chèques (receptionnés en caisse) en banque
  [TRANSACTION_ID.dépôt_caisse_chèques]: {
    label: 'REMISE DE CHÈQUES',
    tooltip: 'retrait de chèques de la caisse vers le compte bancaire',
    class: TRANSACTION_CLASS.MOVEMENT,
    financial_accounts: [...financial_credits, ...financial_debits],
    // profit_and_loss_accounts: FINANCIAL_ACCOUNT.BANK_debit,
    financial_accounts_to_charge: [FINANCIAL_ACCOUNT.CASHBOX_credit, FINANCIAL_ACCOUNT.BANK_debit],
    nominative: false,
    pure_financial: true,
    revenue_account_to_show: false,
    require_deposit_ref: true,
    cash: 'none',
    cheque: 'out',
  },
  // versement sur compte épargne
  [TRANSACTION_ID.virement_banque_vers_épargne]: {
    label: 'VERSEMENT SUR COMPTE ÉPARGNE',
    tooltip: 'virement du compte courant vers le compte épargne',
    class: TRANSACTION_CLASS.MOVEMENT,
    financial_accounts: [...financial_credits, ...financial_debits],
    // profit_and_loss_accounts: FINANCIAL_ACCOUNT.SAVING_debit,
    financial_accounts_to_charge: [FINANCIAL_ACCOUNT.BANK_credit, FINANCIAL_ACCOUNT.SAVING_debit],
    nominative: false,
    pure_financial: true,
    revenue_account_to_show: false,
    require_deposit_ref: false,
    cash: 'none',
    cheque: 'none',
  },
  // retrait du compte épargne
  [TRANSACTION_ID.retrait_épargne_vers_banque]: {
    label: 'RETRAIT DU COMPTE ÉPARGNE',
    tooltip: 'retrait du compte épargne vers le compte courant',
    class: TRANSACTION_CLASS.MOVEMENT,
    // profit_and_loss_accounts: FINANCIAL_ACCOUNT.BANK_debit,
    financial_accounts: [...financial_credits, ...financial_debits],
    financial_accounts_to_charge: [FINANCIAL_ACCOUNT.BANK_debit, FINANCIAL_ACCOUNT.SAVING_credit],
    nominative: false,
    pure_financial: true,
    revenue_account_to_show: false,
    require_deposit_ref: false,
    cash: 'none',
    cheque: 'none',
  },



  // E depense pour adhérent ****
  // ****  CLASS = EXPENS_FOR_MEMBER ****

  // émission d'avoir à un adhérent
  [TRANSACTION_ID.attribution_avoir]: {
    label: 'attribution d\'avoir(s) nominatif(s)',
    tooltip: 'attribution d\'avoir(s) nominatif(s)',
    class: TRANSACTION_CLASS.EXPENSE_FOR_MEMBER,
    financial_accounts: [],
    optional_accounts: customer_asset_credit,
    financial_accounts_to_charge: [CUSTOMER_ACCOUNT.ASSET_credit],
    nominative: true,
    pure_financial: false,
    revenue_account_to_show: false,
    require_deposit_ref: false,
    cash: 'none',
    cheque: 'none',
  },

  // annulation d'une dette adhérent
  [TRANSACTION_ID.annulation_dette_adhérent]: {
    label: 'annulation d\'une dette',
    tooltip: 'annulation d\'une dette adhérent',
    class: TRANSACTION_CLASS.EXPENSE_FOR_MEMBER,
    financial_accounts: [],
    optional_accounts: customer_options,
    financial_accounts_to_charge: [CUSTOMER_ACCOUNT.DEBT_credit],
    nominative: true,
    pure_financial: false,
    revenue_account_to_show: false,
    require_deposit_ref: false,
    cash: 'none',
    cheque: 'none',
  },

  // classe REIMBURSEMENT

  // remboursement d'achat par chèque
  [TRANSACTION_ID.remboursement_achat_adhérent_par_chèque]: {
    label: 'remboursement par chèque',
    tooltip: 'remboursement d\'un achat adhérent par chèque',
    class: TRANSACTION_CLASS.REIMBURSEMENT,
    financial_accounts: financial_credits,
    financial_accounts_to_charge: [FINANCIAL_ACCOUNT.BANK_credit],
    nominative: true,
    pure_financial: false,
    revenue_account_to_show: true,
    require_deposit_ref: false,
    cash: 'none',
    cheque: 'out',
  },
  // remboursement d'achat en espèces
  [TRANSACTION_ID.remboursement_achat_adhérent_en_espèces]: {
    label: 'remboursement en espèces',
    tooltip: 'remboursement d\'un achat adhérent en espèces',
    class: TRANSACTION_CLASS.REIMBURSEMENT,
    financial_accounts: financial_credits,
    financial_accounts_to_charge: [FINANCIAL_ACCOUNT.CASHBOX_credit],
    nominative: true,
    pure_financial: false,
    revenue_account_to_show: true,
    require_deposit_ref: false,
    cash: 'out',
    cheque: 'none',
  },
  // remboursement d'achat par avoir
  [TRANSACTION_ID.remboursement_achat_adhérent_par_avoir]: {
    label: 'remboursement par avoir',
    tooltip: 'remboursement d\'un achat adhérent par avoir',
    class: TRANSACTION_CLASS.REIMBURSEMENT,
    financial_accounts: [],
    optional_accounts: customer_asset_credit,
    financial_accounts_to_charge: [CUSTOMER_ACCOUNT.ASSET_credit],
    nominative: true,
    pure_financial: false,
    revenue_account_to_show: true,
    require_deposit_ref: false,
    cash: 'none',
    cheque: 'none',
  },


 // F. achat , dépenses
  // ****  CLASS = EXPENSE ****

  // achat en espèces d'une prestation ou service
  [TRANSACTION_ID.dépense_en_espèces]: {
    label: 'achat en espèces',
    tooltip: 'paiement en espèces d\'une prestation ou service',
    class: TRANSACTION_CLASS.OTHER_EXPENSE,
    financial_accounts: financial_credits,
    financial_accounts_to_charge: [FINANCIAL_ACCOUNT.CASHBOX_credit],
    nominative: false,
    pure_financial: false,
    revenue_account_to_show: false,
    require_deposit_ref: false,
    cash: 'out',
    cheque: 'none',
  },

  // paiement par chèque d'une prestation ou service
  [TRANSACTION_ID.dépense_par_chèque]: {
    label: 'CHEQUE EMIS',
    tooltip: 'paiement par chèque d\'une prestation ou service',
    class: TRANSACTION_CLASS.OTHER_EXPENSE,
    financial_accounts: financial_credits,
    financial_accounts_to_charge: [FINANCIAL_ACCOUNT.BANK_credit],
    // optional_accounts: balance_sheet_accounts,
    nominative: false,
    pure_financial: false,
    revenue_account_to_show: false,
    require_deposit_ref: false,
    cash: 'none',
    cheque: 'out',
  },
  // paiement à un tiers d'une prestation ou service par virement
  [TRANSACTION_ID.dépense_par_virement]: {
    label: 'VIREMENT EMIS',
    tooltip: 'paiement par virement d\'une prestation ou service',
    class: TRANSACTION_CLASS.OTHER_EXPENSE,
    financial_accounts: financial_credits,
    financial_accounts_to_charge: [FINANCIAL_ACCOUNT.BANK_credit],
    nominative: false,
    pure_financial: false,
    revenue_account_to_show: false,
    require_deposit_ref: false,
    cash: 'none',
    cheque: 'none',
  },
  // paiement par carte bancaire d'une prestation ou de marchandises
  [TRANSACTION_ID.dépense_par_carte]: {
    label: 'PAIEMENT PAR CARTE',
    tooltip: 'achat par carte bancaire',
    class: TRANSACTION_CLASS.OTHER_EXPENSE,
    financial_accounts: financial_credits,
    financial_accounts_to_charge: [FINANCIAL_ACCOUNT.BANK_credit],
    nominative: false,
    pure_financial: false,
    revenue_account_to_show: false,
    require_deposit_ref: false,
    cash: 'none',
    cheque: 'none',
  },
  // prélèvement sur le compte bancaire par une autre entité
  [TRANSACTION_ID.dépense_par_prélèvement]: {
    label: 'PRÉLÈVEMENT',
    tooltip: 'prélèvement sur le compte bancaire',
    class: TRANSACTION_CLASS.OTHER_EXPENSE,
    financial_accounts: financial_credits,
    financial_accounts_to_charge: [FINANCIAL_ACCOUNT.BANK_credit],
    nominative: false,
    pure_financial: false,
    revenue_account_to_show: false,
    require_deposit_ref: false,
    cash: 'none',
    cheque: 'none',
  },

  // G. opérations spécifiques bilan
  // ****  CLASS = BALANCE_SHEET ****

  [TRANSACTION_ID.report_avoir]: {
    label: 'report d\'avoir',
    tooltip: 'report d\'avoir adhérent',
    class: TRANSACTION_CLASS.BALANCE,
    financial_accounts: [{ key: BALANCE_ACCOUNT.BAL_debit, label: 'report_in', description: 'passif' }],
    optional_accounts: [{ key: CUSTOMER_ACCOUNT.ASSET_credit, label: 'Avoir', description: 'valeur de l\'avoir attribué' }],
    financial_accounts_to_charge: [ BALANCE_ACCOUNT.BAL_debit],
    nominative: true,
    pure_financial: true,
    revenue_account_to_show: false,
    require_deposit_ref: false,
    cash: 'none',
    cheque: 'none',
  },
  // report d'encours paiement par chèque d'une prestation ou service
  [TRANSACTION_ID.report_chèque]: {
    label: 'REPORT CHEQUE',
    tooltip: 'report d\'un chèque non encaissé sur l\'année suivante',
    class: TRANSACTION_CLASS.BALANCE,
    financial_accounts: [...balance_sheet_accounts, ...financial_credits],
    financial_accounts_to_charge: [BALANCE_ACCOUNT.BAL_debit, FINANCIAL_ACCOUNT.BANK_credit],
    // optional_accounts: balance_sheet_accounts,
    nominative: false,
    pure_financial: true,
    revenue_account_to_show: false,
    require_deposit_ref: true,
    cash: 'none',
    cheque: 'out',
  },
  // report d'encours paiement par carte d'une prestation ou service
  [TRANSACTION_ID.report_carte]: {
    label: 'REPORT CARTE',
    tooltip: 'report d\'une carte non encaissée l\'année précédente',
    class: TRANSACTION_CLASS.BALANCE,
    financial_accounts: [...balance_sheet_accounts, ...financial_credits],
    financial_accounts_to_charge: [BALANCE_ACCOUNT.BAL_debit, FINANCIAL_ACCOUNT.BANK_credit],
    // optional_accounts: balance_sheet_accounts,
    nominative: false,
    pure_financial: true,
    revenue_account_to_show: false,
    require_deposit_ref: false,
    cash: 'none',
    cheque: 'none',
  },
  [TRANSACTION_ID.report_dette]: {
    label: 'report de dette',
    tooltip: 'report d\'une dette adhérent sur l\'année suivante',
    class: TRANSACTION_CLASS.BALANCE,
    financial_accounts: [...balance_sheet_accounts],
    financial_accounts_to_charge: [BALANCE_ACCOUNT.BAL_credit],
    optional_accounts: [{ key: CUSTOMER_ACCOUNT.DEBT_debit, label: 'dette', description: 'montant de la dette' }],
    nominative: true,
    pure_financial: true,
    revenue_account_to_show: false,
    require_deposit_ref: false,
    cash: 'none',
    cheque: 'none',
  },
  [TRANSACTION_ID.report_prélèvement]: {
    label: 'REPORT PRELEVEMENT',
    tooltip: 'report d\'un prélèvement non encaissé sur l\'année suivante',
    class: TRANSACTION_CLASS.BALANCE,
    financial_accounts: [...balance_sheet_accounts, ...financial_credits],
    financial_accounts_to_charge: [BALANCE_ACCOUNT.BAL_debit, FINANCIAL_ACCOUNT.BANK_credit],
    // optional_accounts: balance_sheet_accounts,
    nominative: false,
    pure_financial: true,
    revenue_account_to_show: false,
    require_deposit_ref: false,
    cash: 'none',
    cheque: 'none',
  },

 


}



// export function class_to_types(op_class: TRANSACTION_CLASS): TRANSACTION_ID[] {
//   let check = Object.values(TRANSACTION_CLASS).includes(op_class);
//   if (check) {
//     return Object.entries(Transactions_definition)
//       .filter(([key, transaction]) => transaction.class === op_class)
//       .map(([key, transaction]) => key as TRANSACTION_ID);
//   } else {
//     console.log('%s n\'est pas une clef de %s', op_class, JSON.stringify(Object.entries(TRANSACTION_CLASS)));
//     throw new Error(`class ${op_class} not found`);
//   }
// }

// export function get_transaction(entry_type: TRANSACTION_ID): Transaction {
//   let check = Object.keys(Transactions_definition).includes(entry_type);
//   if (check) {
//     return Transactions_definition[entry_type];
//   } else {
//     throw new Error(`transaction ${entry_type} not found`);
//   }
// }
