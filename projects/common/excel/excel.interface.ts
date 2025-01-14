// compta.xls file definition

import { FINANCIAL_ACCOUNTS } from "../accounting.interface";



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

    'pointage': 'AM',
    'n° chèque': 'AN',
    'bordereau': 'AO',
    'verif balance': 'AP',
    'nature': 'AQ',
}

export type ACCOUNTS_COL = { [key: string]: string }

export const PRODUCTS_COL: ACCOUNTS_COL = {
    'ADH': 'L',
    'LIC': 'M',
    'CAR': 'O',
    'DdT': 'N',
    'PER': 'J',
    'INI': 'I',
    'BIB': 'G',
    //  'KFE': 'K',
    'FET': 'H',
    //  'BNQ': 'X',
    'DIV': 'K',
}

export const EXPENSES_COL: ACCOUNTS_COL = {
    'LIC': 'P',
    'FFB': 'Q',
    'BRP': 'R',
    'FOR': 'S',
    'BIB': 'T',
    'MAT': 'U',
    'WEB': 'V',
    'CMP': 'W',
    'REU': 'X',
    'FET': 'Y',
    'KFE': 'Z',
    'DIV': 'AA',
    'BNQ': 'AB',
    'KDO': 'AC',
}

export const FINANCIAL_COL: { [key in FINANCIAL_ACCOUNTS]?: string } = {
    'creance_in': 'AC',
    'avoir_in': 'AD',
    'cash_in': 'AE',
    'bank_in': 'AF',
    'saving_in': 'AG',
    'creance_out': 'AH',
    'avoir_out': 'AI',
    'cash_out': 'AJ',
    'bank_out': 'AK',
    'saving_out': 'AL',
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

