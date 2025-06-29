// compta.xls file definition

import { BALANCE_ACCOUNT, CUSTOMER_ACCOUNT, FINANCIAL_ACCOUNT } from "../accounting.interface";



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

export const MAP = {
  'chrono': 'A',
  'date': 'B',
  'mois': 'C',
  'intitulé': 'D',
  'info': 'E',
  'n° carte': 'F',

  // 'products': 'G:O',
  // 'expenses': 'P:AB',
  // 'book_entry': 'AC:AL',

  'pointage': 'AS',
  'n° chèque': 'AT',
  'bordereau': 'AU',
  'verif balance': 'AV',
  'nature': 'AW',
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

export const EXTRA_CUSTOMER_IN: { [key in CUSTOMER_ACCOUNT]?: string } = {
  'creance_in': 'AG',
  'avoir_in': 'AH',
}
export const EXTRA_CUSTOMER_OUT: { [key in CUSTOMER_ACCOUNT]?: string } = {
  'creance_out': 'AM',
  'avoir_out': 'AN',
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

