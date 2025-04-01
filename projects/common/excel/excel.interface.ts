// compta.xls file definition

import { CUSTOMER_ACCOUNT, FINANCIAL_ACCOUNT } from "../accounting.interface";



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

  'pointage': 'AL',
  'n° chèque': 'AM',
  'bordereau': 'AN',
  'verif balance': 'AO',
  'nature': 'AP',
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
  //  'KFE': 'K',
  //  'BNQ': 'X',
}

export const EXPENSES_COL: ACCOUNTS_COL = {
  'LIC': 'P',
  'FFB': 'Q',
  'BRP': 'R',
  'FOR': 'S',
  'MAT': 'T',
  'WEB': 'U',
  'CMP': 'V',
  'REU': 'W',
  'FET': 'X',
  'KFE': 'Y',
  'DIV': 'Z',
  'BNQ': 'AA',
}

export const FINANCIAL_COL: { [key in FINANCIAL_ACCOUNT | CUSTOMER_ACCOUNT]?: string } = {
  'creance_in': 'AB',
  'avoir_in': 'AC',
  'cashbox_in': 'AD',
  'bank_in': 'AE',
  'saving_in': 'AF',
  'creance_out': 'AG',
  'avoir_out': 'AH',
  'cashbox_out': 'AI',
  'bank_out': 'AJ',
  'saving_out': 'AK',
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

