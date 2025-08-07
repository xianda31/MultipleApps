// compta.xls file definition

import { BALANCE_ACCOUNT, CUSTOMER_ACCOUNT, FINANCIAL_ACCOUNT, TRANSACTION_ID } from "../accounting.interface";



export enum COL {
  A = 1,
  B = 2,
  C = 3,
  D = 4,
  E = 5,
  F = 6,
  G = 7,
  H = 8,
  I = 9,
  J = 10,
  K = 11,
  L = 12,
  M = 13,
  N = 14,
  O = 15,
  P = 16,
  Q = 17,
  R = 18,
  S = 19,
  T = 20,
  U = 21,
  V = 22,
  W = 23,
  X = 24,
  Y = 25,
  Z = 26,
  AA = 27,
  AB = 28,
  AC = 29,
  AD = 30,
  AE = 31,
  AF = 32,
  AG = 33,
  AH = 34,
  AI = 35,
  AJ = 36,
  AK = 37,
  AL = 38,
  AM = 39,
  AN = 40,
  AO = 41,
  AP = 42,
  AQ = 43,
  AR = 44,
  AS = 45,
  AT = 46,
  AU = 47,
  AV = 48,
  AW = 49,
  AX = 50,
}

export const MAP_start = {
  'chrono': 'A',
  'date': 'B',
  'mois': 'C',
  'intitulé': 'D',
  'info': 'E',
  'n° carte': 'F',
}

export const MAP_end = {

  'pointage': 'AS',
  'n° chèque': 'AT',
  'bordereau': 'AU',
  'verif balance': 'AV',
  'nature': 'AW',
}

export const MAP = {
...MAP_start,
  ... MAP_end
}

export type ACCOUNTS_COL = { [key: string]: string }

export const PRODUCTS_COL: ACCOUNTS_COL = {
  'BIB': 'G',
  'PAF': 'H',
  'INI': 'I',
  'PER': 'J',
  'AUT': 'K',
  'ADH': 'L',
  'LIC': 'M',
  'DdT': 'N',
  'CAR': 'O',
   'KFE': 'P',
   'DON': 'Q',
   'BNQ': 'R',
}


export const EXPENSES_COL: ACCOUNTS_COL = {
  'LIC': 'S',
  'FFB': 'T',
  'BRP': 'U',
  'FOR': 'V',
  'MAT': 'W',
  'COM': 'X',
  'CMP': 'Y',
  'REU': 'Z',
  'FET': 'AA',
  'KFE': 'AB',
  'AUT': 'AC',
  'BIB': 'AD',
  'DON': 'AE',
  'BNQ': 'AF',
}

export const CUSTOMER_COL : { [key in CUSTOMER_ACCOUNT]: string } = {
  'creance_in': 'AG',
  'avoir_in': 'AH',
  'creance_out': 'AM',
  'avoir_out': 'AN',
}

export const EXTRA_CUSTOMER_IN: { [key in CUSTOMER_ACCOUNT]?: string } = {
  'creance_in': 'AG',
  'avoir_in': 'AH',
}
export const EXTRA_CUSTOMER_OUT: { [key in CUSTOMER_ACCOUNT]?: string } = {
  'creance_out': 'AM',
  'avoir_out': 'AN',
}

export const FINANCIAL_COL_in : { [key in FINANCIAL_ACCOUNT | BALANCE_ACCOUNT]?: string } = {
  'cashbox_in': 'AI',
  'bank_in': 'AJ',
  'saving_in': 'AK',
  'report_in': 'AL',
} 

export const FINANCIAL_COL_out: { [key in FINANCIAL_ACCOUNT | BALANCE_ACCOUNT]?: string } = {
  'cashbox_out': 'AO',
  'bank_out': 'AP',
  'saving_out': 'AQ',
  'report_out': 'AR',
}

export const FINANCIAL_COL: { [key in FINANCIAL_ACCOUNT | BALANCE_ACCOUNT]: string } = {
  'cashbox_in': 'AI',
  'bank_in': 'AJ',
  'saving_in': 'AK',
  'report_in': 'AL',

  'cashbox_out': 'AO',
  'bank_out': 'AP',
  'saving_out': 'AQ',
  'report_out': 'AR',
}




export const xls_header = [
  // 'chrono'
  'Date',
  // 'mois',
  // 'type',
  'Bénéficiaire',
  // 'info',
  'Nature',
  'n° pièce',

  'BIB', //'autre',
  'PAF',
  'INI', //'initiation',
  'PER', //'perfectionnement',
  'SUB', //'subvention',
  'ADH', //'adhésion',
  'LIC',  //'licence',
  //'droit de table',
  'TAB', //'carte',

  // 'ref carte',

  // 'license',
  // 'FFB',
  // 'Bridge+',
  // 'Formation',
  // 'Matériel',
  // 'PTT',
  // 'Compétitions',
  // 'réunions',
  // 'fêtes',
  // 'café-eau',
  // 'autre',
  // 'banque',

  // 'Dette',
  // 'Avoir',

  // 'Caisse entrée',
  // 'Caisse sortie',

  // 'Banque entrée',
  // 'Banque sortie',

  // 'pointage',
  // 'bordereau',

  // 'verif balance',
  // 'verif dépot',
  // 'verif caisse',
];

export const TRANSACTION_ID_TO_NATURE: { [key in TRANSACTION_ID]?: string } = {
  [TRANSACTION_ID.report_prélèvement]: 'report prélèvement',
  [TRANSACTION_ID.report_chèque]: 'report chèque',
  [TRANSACTION_ID.report_carte]: 'report carte',  
  [TRANSACTION_ID.dépôt_collecte_espèces]: 'versement espèces', // or 'fond en espèces'
  [TRANSACTION_ID.dépôt_collecte_chèques]: 'versement chèques',
  [TRANSACTION_ID.dépôt_caisse_espèces]: 'remise espèces',
  [TRANSACTION_ID.dépôt_caisse_chèques]: 'remise chèques',
  [TRANSACTION_ID.vente_en_espèces]: 'vente en espèces',
  [TRANSACTION_ID.vente_par_chèque]: 'vente par chèque',
  [TRANSACTION_ID.dépense_par_chèque]: 'chèque émis',
  [TRANSACTION_ID.attribution_avoir]: 'attribution_avoir',
  [TRANSACTION_ID.vente_par_virement]: 'virement reçu',
  [TRANSACTION_ID.dépense_en_espèces]: 'achat en espèces',
  [TRANSACTION_ID.dépense_par_virement]: 'virement émis',
  [TRANSACTION_ID.dépense_par_prélèvement]: 'prélèvement',
  [TRANSACTION_ID.dépense_par_carte]: 'carte',
  [TRANSACTION_ID.virement_banque_vers_épargne]: 'versement compte épargne', // or 'versement épargne'
  [TRANSACTION_ID.retrait_épargne_vers_banque]: 'retrait épargne',
  [TRANSACTION_ID.intérêt_épargne]: 'intérêts',
  [TRANSACTION_ID.report_avoir]: 'report avoir',
  [TRANSACTION_ID.achat_adhérent_par_virement]: 'virement reçu',
  [TRANSACTION_ID.achat_adhérent_par_chèque]: 'paiement par chèque',
  [TRANSACTION_ID.achat_adhérent_en_espèces]: 'paiement en espèces',
  [TRANSACTION_ID.remboursement_achat_adhérent_par_chèque]: 'remboursement par chèque',
  // [TRANSACTION_ID.vente_en_espèces]: 'espèces',
  // [TRANSACTION_ID.vente_par_chèque]: 'chèque',
};

export const TRANSACTION_ID_TO_CHRONO: { [key in TRANSACTION_ID]?: string } = {
  [TRANSACTION_ID.report_prélèvement]: 'B',
  [TRANSACTION_ID.report_chèque]: 'B',
  [TRANSACTION_ID.dépôt_collecte_espèces]: 'B', // or 'fond en espèces'
  [TRANSACTION_ID.dépôt_collecte_chèques]: 'B',
  [TRANSACTION_ID.dépôt_caisse_espèces]: 'B',
  [TRANSACTION_ID.dépôt_caisse_chèques]: 'B',
  [TRANSACTION_ID.vente_en_espèces]: 'K',
  [TRANSACTION_ID.vente_par_chèque]: 'C',
  [TRANSACTION_ID.dépense_par_chèque]: 'B',
  [TRANSACTION_ID.attribution_avoir]: 'B',
  [TRANSACTION_ID.vente_par_virement]: 'C',
  [TRANSACTION_ID.dépense_en_espèces]: 'K',
  [TRANSACTION_ID.dépense_par_virement]: 'B',
  [TRANSACTION_ID.dépense_par_prélèvement]: 'B',
  [TRANSACTION_ID.dépense_par_carte]: 'B',
  [TRANSACTION_ID.virement_banque_vers_épargne]: 'B', 
  [TRANSACTION_ID.retrait_épargne_vers_banque]: 'B',
  [TRANSACTION_ID.intérêt_épargne]: 'B',
  [TRANSACTION_ID.report_avoir]: 'C',
  [TRANSACTION_ID.achat_adhérent_par_virement]: 'C',
  [TRANSACTION_ID.achat_adhérent_par_chèque]: 'C',
  [TRANSACTION_ID.achat_adhérent_en_espèces]: 'C',
  [TRANSACTION_ID.remboursement_achat_adhérent_par_chèque]: 'C',
  // [TRANSACTION_ID.vente_en_espèces]: 'espèces',
  // [TRANSACTION_ID.vente_par_chèque]: 'chèque',
};

