import { FINANCIAL_ACCOUNT, BOOK_ENTRY_CLASS, ENTRY_TYPE, CUSTOMER_ACCOUNT, BALANCE_ACCOUNT } from './accounting.interface';

export const _CHEQUE_IN_CASHBOX: boolean = true;     // flag to indicate if cheques are first deposited in cashbox

export const _CHEQUE_IN_ACCOUNT: FINANCIAL_ACCOUNT = _CHEQUE_IN_CASHBOX ? FINANCIAL_ACCOUNT.CASHBOX_debit : FINANCIAL_ACCOUNT.BANK_debit;

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
export const customer_assets: Account_def[] = [
  { key: CUSTOMER_ACCOUNT.ASSET_debit, label: '-AVOIR', description: 'déduction d\'un avoir' },
  { key: CUSTOMER_ACCOUNT.DEBT_credit, label: '+DETTE', description: 'remboursement d\'une dette' },
]
export const customer_debt: Account_def[] = [
  { key: CUSTOMER_ACCOUNT.ASSET_debit, label: '-Avoir', description: 'utilisation d\'un avoir' },
  { key: CUSTOMER_ACCOUNT.DEBT_debit, label: 'DETTE', description: 'montant du"crédit"' },
]

export const balance_sheet_accounts: Account_def[] = [
  { key: BALANCE_ACCOUNT.BAL_credit, label: 'BAL_credit', description: 'actif' },
  { key: BALANCE_ACCOUNT.BAL_debit, label: 'BAL_debit', description: 'report année N-1' },
]

export const class_definitions: { [key in BOOK_ENTRY_CLASS]: string } = {
  [BOOK_ENTRY_CLASS.a_REVENUE_FROM_MEMBER]: 'achat adhérent',
  [BOOK_ENTRY_CLASS.b_OTHER_EXPENSE]: 'dépense non nominative',
  [BOOK_ENTRY_CLASS.c_OTHER_REVENUE]: 'recette non nominative',
  [BOOK_ENTRY_CLASS.d_EXPENSE_FOR_MEMBER]: 'dépense en faveur d\'adhérent',
  [BOOK_ENTRY_CLASS.e_MOVEMENT]: 'mouvement bancaire',
  [BOOK_ENTRY_CLASS.f_BALANCE_SHEET]: 'opérations spécifiques au bilan',
}

export type Transaction = {
  class: BOOK_ENTRY_CLASS,
  label: string,
  financial_accounts: Account_def[],
  optional_accounts?: Account_def[],
  financial_accounts_to_charge: Array<FINANCIAL_ACCOUNT | CUSTOMER_ACCOUNT | BALANCE_ACCOUNT>,
  nominative: boolean,
  pure_financial: boolean,
  is_of_profit_type?: boolean,
  require_deposit_ref: boolean,
  cash: 'in' | 'out' | 'none',
  cheque: 'in' | 'out' | 'none'
};

export const TRANSACTIONS: { [key in ENTRY_TYPE]: Transaction } = {

  // A.  vente à  adhérent ****
  // ****  CLASS = a_REVENUE_FROM_MEMBER ****

  // paiement en espèces par un adhérent
  [ENTRY_TYPE.payment_in_cash]: {
    label: 'paiement en espèces',
    class: BOOK_ENTRY_CLASS.a_REVENUE_FROM_MEMBER,
    financial_accounts: financial_debits,
    optional_accounts: customer_assets,
    financial_accounts_to_charge: [FINANCIAL_ACCOUNT.CASHBOX_debit],
    nominative: true,
    pure_financial: false,
    is_of_profit_type: true,
    require_deposit_ref: false,
    cash: 'in',
    cheque: 'none',
  },
  // paiement par chèque par un adhérent
  [ENTRY_TYPE.payment_by_cheque]: {
    label: 'paiement par chèque',
    class: BOOK_ENTRY_CLASS.a_REVENUE_FROM_MEMBER,
    financial_accounts: financial_debits,
    optional_accounts: customer_assets,
    financial_accounts_to_charge: _CHEQUE_IN_CASHBOX ? [FINANCIAL_ACCOUNT.CASHBOX_debit] : [FINANCIAL_ACCOUNT.BANK_debit],
    nominative: true,
    pure_financial: false,
    is_of_profit_type: true,
    require_deposit_ref: false,
    cash: 'none',
    cheque: 'in',
  },
  // vente à crédit (créance) à un adhérent
  [ENTRY_TYPE.payment_on_credit]: {
    label: 'paiement à \"crédit\"',
    class: BOOK_ENTRY_CLASS.a_REVENUE_FROM_MEMBER,
    financial_accounts: [],
    optional_accounts: customer_debt,
    financial_accounts_to_charge: [CUSTOMER_ACCOUNT.DEBT_debit],
    nominative: true,
    pure_financial: false,
    is_of_profit_type: true,
    require_deposit_ref: false,
    cash: 'none',
    cheque: 'none',
  },
  // paiement par virement d'un adhérent
  [ENTRY_TYPE.payment_by_transfer]: {
    label: 'VIREMENT EN NOTRE FAVEUR',
    class: BOOK_ENTRY_CLASS.a_REVENUE_FROM_MEMBER,
    financial_accounts: financial_debits,
    optional_accounts: customer_assets,
    financial_accounts_to_charge: [FINANCIAL_ACCOUNT.BANK_debit],
    nominative: true,
    pure_financial: false,
    is_of_profit_type: true,
    require_deposit_ref: false,
    cash: 'none',
    cheque: 'none',
  },

  //B.  vente unitaire à tiers ****
  // ****  CLASS = c_OTHER_REVENUE ****

  // reception d'espèces de la par d'autres qu'un adhérent
  [ENTRY_TYPE.cash_receipt]: {
    label: 'paiement en espèces',
    class: BOOK_ENTRY_CLASS.c_OTHER_REVENUE,
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
  [ENTRY_TYPE.cheque_receipt]: {
    label: 'paiement par chèque',
    class: BOOK_ENTRY_CLASS.c_OTHER_REVENUE,
    financial_accounts: financial_debits,
    financial_accounts_to_charge: _CHEQUE_IN_CASHBOX ? [FINANCIAL_ACCOUNT.CASHBOX_debit] : [FINANCIAL_ACCOUNT.BANK_debit],
    nominative: false,
    pure_financial: false,
    is_of_profit_type: true,
    require_deposit_ref: false,
    cash: 'none',
    cheque: 'in',
  },
  [ENTRY_TYPE.transfer_receipt]: {
    label: 'VIREMENT EN NOTRE FAVEUR',
    class: BOOK_ENTRY_CLASS.c_OTHER_REVENUE,
    financial_accounts: financial_debits,
    financial_accounts_to_charge: [FINANCIAL_ACCOUNT.BANK_debit],
    nominative: false,
    pure_financial: false,
    is_of_profit_type: true,
    require_deposit_ref: false,
    cash: 'none',
    cheque: 'none',
  },

  // C. depense pour adhérent ****
  // ****  CLASS = EXPENS_FOR_MEMBER ****

  // émission d'avoir à un adhérent
  [ENTRY_TYPE.asset_emit]: {
    label: 'attribution d\'avoir(s) nominatif(s)',
    class: BOOK_ENTRY_CLASS.d_EXPENSE_FOR_MEMBER,
    financial_accounts: [],
    optional_accounts: [{ key: CUSTOMER_ACCOUNT.ASSET_credit, label: 'Avoir', description: 'valeur de l\'avoir attribué' }],
    financial_accounts_to_charge: [CUSTOMER_ACCOUNT.ASSET_credit],
    nominative: true,
    pure_financial: false,
    is_of_profit_type: false,
    require_deposit_ref: false,
    cash: 'none',
    cheque: 'none',
  },



  // D. reception groupée de fond de tiers  ****
  // ****  CLASS = c_OTHER_REVENUE ****

  // dépot de fonds en espèces
  [ENTRY_TYPE.cash_raising]: {
    label: 'VERSEMENT D\'ESPÈCES',
    class: BOOK_ENTRY_CLASS.c_OTHER_REVENUE,
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
  [ENTRY_TYPE.cheques_raising]: {
    label: 'REMISE DE CHÈQUES',
    class: BOOK_ENTRY_CLASS.c_OTHER_REVENUE,
    financial_accounts: financial_debits,
    financial_accounts_to_charge: [FINANCIAL_ACCOUNT.BANK_debit],
    nominative: false,
    pure_financial: false,
    is_of_profit_type: true,
    require_deposit_ref: true,
    cash: 'none',
    cheque: 'none',
  },
  // E.  mouvements de fonds ****
  // ****  CLASS = e_MOVEMENT ****

  // dépot d'espèces (de la caisse) en banque
  [ENTRY_TYPE.cash_deposit]: {
    label: 'VERSEMENT D\'ESPÈCES',
    class: BOOK_ENTRY_CLASS.e_MOVEMENT,
    financial_accounts: [...financial_credits, ...financial_debits],
    financial_accounts_to_charge: [FINANCIAL_ACCOUNT.CASHBOX_credit, FINANCIAL_ACCOUNT.BANK_debit],
    nominative: false,
    pure_financial: true,
    require_deposit_ref: true,
    cash: 'out',
    cheque: 'none',
  },
  // dépot de chèques (receptionnés en caisse) en banque
  [ENTRY_TYPE.cheque_deposit]: {
    label: 'REMISE DE CHÈQUES',
    class: BOOK_ENTRY_CLASS.e_MOVEMENT,
    financial_accounts: [...financial_credits, ...financial_debits],
    // profit_and_loss_accounts: FINANCIAL_ACCOUNT.BANK_debit,
    financial_accounts_to_charge: [FINANCIAL_ACCOUNT.CASHBOX_credit, FINANCIAL_ACCOUNT.BANK_debit],
    nominative: false,
    pure_financial: true,
    require_deposit_ref: true,
    cash: 'none',
    cheque: 'none',
  },
  // versement sur compte épargne
  [ENTRY_TYPE.saving_deposit]: {
    label: 'VERSEMENT SUR COMPTE ÉPARGNE',
    class: BOOK_ENTRY_CLASS.e_MOVEMENT,
    financial_accounts: [...financial_credits, ...financial_debits],
    // profit_and_loss_accounts: FINANCIAL_ACCOUNT.SAVING_debit,
    financial_accounts_to_charge: [FINANCIAL_ACCOUNT.BANK_credit, FINANCIAL_ACCOUNT.SAVING_debit],
    nominative: false,
    pure_financial: true,
    require_deposit_ref: false,
    cash: 'none',
    cheque: 'none',
  },
  // retrait du compte épargne
  [ENTRY_TYPE.saving_withdraw]: {
    label: 'RETRAIT DU COMPTE ÉPARGNE',
    class: BOOK_ENTRY_CLASS.e_MOVEMENT,
    // profit_and_loss_accounts: FINANCIAL_ACCOUNT.BANK_debit,
    financial_accounts: [...financial_credits, ...financial_debits],
    financial_accounts_to_charge: [FINANCIAL_ACCOUNT.BANK_debit, FINANCIAL_ACCOUNT.SAVING_credit],
    nominative: false,
    pure_financial: true,
    require_deposit_ref: false,
    cash: 'none',
    cheque: 'none',
  },

  // E. opérations spécifiques bilan
  // ****  CLASS = BALANCE_SHEET ****

  [ENTRY_TYPE.asset_forwarding]: {
    label: 'report  d\'avoir(s) nominatif(s)',
    class: BOOK_ENTRY_CLASS.f_BALANCE_SHEET,
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
  // report d'encours qpaiement par chèque d'une prestation ou service
  [ENTRY_TYPE.cheque_forwarding]: {
    label: 'report d\'encours de chèque(s)',
    class: BOOK_ENTRY_CLASS.f_BALANCE_SHEET,
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


  // F. achat , dépenses
  // ****  CLASS = EXPENSE ****

  // paiement par chèque d'une prestation ou service
  [ENTRY_TYPE.cheque_emit]: {
    label: 'CHEQUE EMIS',
    class: BOOK_ENTRY_CLASS.b_OTHER_EXPENSE,
    financial_accounts: financial_credits,
    financial_accounts_to_charge: [FINANCIAL_ACCOUNT.BANK_credit],
    optional_accounts: balance_sheet_accounts,
    nominative: false,
    pure_financial: false,
    is_of_profit_type: false,
    require_deposit_ref: false,
    cash: 'none',
    cheque: 'out',
  },
  // paiement à un tiers d'une prestation ou service par virement
  [ENTRY_TYPE.transfer_emit]: {
    label: 'VIREMENT EMIS',
    class: BOOK_ENTRY_CLASS.b_OTHER_EXPENSE,
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
  [ENTRY_TYPE.card_payment]: {
    label: 'PAIEMENT PAR CARTE',
    class: BOOK_ENTRY_CLASS.b_OTHER_EXPENSE,
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
  [ENTRY_TYPE.bank_debiting]: {
    label: 'PRÉLÈVEMENT',
    class: BOOK_ENTRY_CLASS.b_OTHER_EXPENSE,
    financial_accounts: financial_credits,
    financial_accounts_to_charge: [FINANCIAL_ACCOUNT.BANK_credit],
    nominative: false,
    pure_financial: false,
    is_of_profit_type: false,
    require_deposit_ref: false,
    cash: 'none',
    cheque: 'none',
  },



}



export function class_types(op_class: BOOK_ENTRY_CLASS): ENTRY_TYPE[] {
  let check = Object.values(BOOK_ENTRY_CLASS).includes(op_class);
  if (check) {
    return Object.entries(TRANSACTIONS)
      .filter(([, mapping]) => mapping.class === op_class)
      .map(([entryType]) => entryType as ENTRY_TYPE);
  } else {
    throw new Error(`class ${op_class} not found`);
  }
}

export function get_transaction(entry_type: ENTRY_TYPE): Transaction {
  let check = Object.keys(TRANSACTIONS).includes(entry_type);
  if (check) {
    return TRANSACTIONS[entry_type];
  } else {
    throw new Error(`transaction ${entry_type} not found`);
  }
}
