export enum TRANSACTION_ID {
  achat_adhérent_en_espèces = 'achat_adhérent_en_espèces',
  achat_adhérent_par_chèque = 'achat_adhérent_par_chèque',
  achat_adhérent_par_virement = 'achat_adhérent_par_virement',
  vente_en_espèces = 'vente_en_espèces',
  vente_par_virement = 'vente_par_virement',
  vente_par_chèque = 'vente_par_chèque',
  dépôt_collecte_espèces = 'dépôt_collecte_espèces',
  dépôt_collecte_chèques = 'dépôt_collecte_chèques',
  intérêt_épargne = 'intérêt_épargne',
  dépôt_caisse_espèces = 'dépôt_caisse_espèces',
  dépôt_caisse_chèques = 'dépôt_caisse_chèques',
  virement_banque_vers_épargne = 'virement_banque_vers_épargne',
  retrait_épargne_vers_banque = 'retrait_épargne_vers_banque',
  attribution_avoir = 'attribution_avoir',
  remboursement_achat_adhérent_par_chèque = 'remboursement_achat_adhérent_par_chèque',
  remboursement_achat_adhérent_en_espèces = 'remboursement_achat_adhérent_en_espèces',  
  remboursement_achat_adhérent_par_avoir = 'remboursement_achat_adhérent_par_avoir',
  annulation_dette_adhérent = 'annulation_dette',
  dépense_en_espèces = 'dépense_en_espèces',
  dépense_par_chèque = 'dépense_par_chèque',
  dépense_par_virement = 'dépense_par_virement',
  dépense_par_carte = 'dépense_par_carte',
 dépense_par_prélèvement = 'dépense_par_prélèvement',
  report_avoir = 'report_avoir',
  report_chèque = 'report_chèque',
  report_carte = 'report_carte',
  report_dette = 'report_dette',
  report_prélèvement = 'report_prélèvement',

}



export enum FINANCIAL_ACCOUNT {
  CASHBOX_debit = 'cashbox_in',
  CASHBOX_credit = 'cashbox_out',

  BANK_debit = 'bank_in',
  SAVING_debit = 'saving_in',

  BANK_credit = 'bank_out',
  SAVING_credit = 'saving_out',

}

export enum CUSTOMER_ACCOUNT {
  ASSET_debit = 'avoir_in',
  DEBT_debit = 'creance_in',
  ASSET_credit = 'avoir_out',
  DEBT_credit = 'creance_out',
}

export enum BALANCE_ACCOUNT {
  BAL_credit = 'report_out',
  BAL_debit = 'report_in',
}

export const Financial_debit_accounts: { [key in Partial<FINANCIAL_ACCOUNT>]?: string } = {
  [FINANCIAL_ACCOUNT.CASHBOX_debit]: 'Caisse',
  [FINANCIAL_ACCOUNT.BANK_debit]: 'Banque',
  [FINANCIAL_ACCOUNT.SAVING_debit]: 'Epargne',
}
export const Financial_credit_accounts: { [key in Partial<FINANCIAL_ACCOUNT>]?: string } = {
  [FINANCIAL_ACCOUNT.CASHBOX_credit]: 'Caisse',
  [FINANCIAL_ACCOUNT.BANK_credit]: 'Banque',
  [FINANCIAL_ACCOUNT.SAVING_credit]: 'Epargne',
}

export const Bank_accounts: { [key in Partial<FINANCIAL_ACCOUNT>]?: string } = {
  [FINANCIAL_ACCOUNT.BANK_debit]: 'bank_in',
  [FINANCIAL_ACCOUNT.BANK_credit]: 'bank_out',
  // [FINANCIAL_ACCOUNT.SAVING_debit]: 'saving_in',
  // [FINANCIAL_ACCOUNT.SAVING_credit]: 'saving_out',
}

export const Savings_accounts : { [key in Partial<FINANCIAL_ACCOUNT>]?: string } = {
  [FINANCIAL_ACCOUNT.SAVING_debit]: 'saving_in',
  [FINANCIAL_ACCOUNT.SAVING_credit]: 'saving_out',
}

export const Cashbox_accounts: { [key in Partial<FINANCIAL_ACCOUNT>]?: string } = {
  [FINANCIAL_ACCOUNT.CASHBOX_debit]: 'cashbox_in',
  [FINANCIAL_ACCOUNT.CASHBOX_credit]: 'cashbox_out',
}




export type operation_values = { [key: string]: number };
export interface Operation {
  label: string;          // libellé de l'opération
  member?: string;        // nom de l'adhérent
  values: operation_values;
}

export interface Session {
  season: string;
  // vendor: string;
  date: string;
}
export interface Revenue extends Operation {
  book_entry_id: string;
  season: string;
  date: string;
  tag?: string;
}// comptes de produits
export interface Expense extends Operation {
  book_entry_id: string;
  season: string;
  date: string;
  tag?: string;
}; // comptes de charges


export type AMOUNTS = { [key in BALANCE_ACCOUNT | FINANCIAL_ACCOUNT  ]?: number; };


export interface BookEntry {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  season: string;
  date: string;
  tag?: string;
  transaction_id: TRANSACTION_ID;   // type d'opération bancaire
  amounts: AMOUNTS
  cheque_ref?: string;        // code banque + numéro de chèque
  bank_report?: string | null;       // (mois) relevé bancaire
  deposit_ref?: string;       //  référence bordereau de dépôt
  operations: Operation[];
}



