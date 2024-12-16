
// export enum BANK_LABEL {
//     none = 'néant',
//     cash_deposit = 'Versement d\'espèces',
//     cash_out = 'Retrait d\'espèces',
//     cheque_deposit = 'Remise de chèque',
//     cheque_emit = 'chèque émis',
//     transfer_receipt = 'Virement reçu',
//     transfer_emit = 'Virement émis',
//     debiting = 'Prélèvement',
//     card_payment = 'Paiement par carte',
//     saving_deposit = 'Versement sur compte \épargne',
//     saving_out = 'Retrait du compte \épargne',
// }

export enum FINANCIALS {
    ASSET_debit = 'avoir_in',
    ASSET_credit = 'avoir_out',
    DEBT_debit = 'creance_in',
    DEBT_credit = 'creance_out',
    CASH_debit = 'cash_in',
    CASH_credit = 'cash_out',
    BANK_debit = 'bank_in',
    BANK_credit = 'bank_out',
    SAVING_debit = 'saving_in',
    SAVING_credit = 'saving_out',
}

export enum EXPENSE {
    ANY = 'ANY',
}
export enum MOVEMENT {
    ANY = 'ANY',
}

export enum REVENUE {
    MEMBER = 'MEMBER',
    ANY = 'ANY',
}

export type OPERATION_TYPE = REVENUE | EXPENSE | MOVEMENT;

export enum PRODUCTS_ACCOUNTS {
    ADH = 'ADH',
    LIC = 'LIC',
    CAR = 'CAR',
    DdT = 'DdT',
    PER = 'PER',
    INI = 'INI',
    BIB = 'BIB',
    KFE = 'KFE',
    FET = 'FET',
    BNQ = 'BNQ',
    DIV = 'DIV',
}

export enum EXPENSES_ACCOUNTS {
    LIC = 'LIC',
    FFB = 'FFB',
    BRP = 'BRP',
    CMP = 'CMP',
    FOR = 'FOR',
    WEB = 'WEB',
    MAT = 'MAT',
    BIB = 'BIB',
    REU = 'REU',
    FET = 'FET',
    KFE = 'KFE',
    DIV = 'DIV',
    BNQ = 'BNQ',
}

export type PRODUCTS_OR_EXPENSES = PRODUCTS_ACCOUNTS | EXPENSES_ACCOUNTS;

export interface Revenue extends Operation { // comptes de produits
    season: string;
    date: string;
};

export interface Expense extends Operation {  // comptes de charges
    season: string;
    date: string;
};

// export interface Movement {
// }

export type op_Value = { [key in PRODUCTS_OR_EXPENSES]?: number };
export type f_Value = { [key in FINANCIALS]?: number; };
export interface Operation {
    label: string;
    operation_type: OPERATION_TYPE;
    amounts: op_Value;
}

export interface Financial { // comptes financiers
    id?: string;
    season: string;
    date: string;
    bank_label: string;

    amounts: f_Value
    operations: Operation[];

    bank_report?: string;

    cheque_ref?: string;
    deposit_ref?: string;
}






// export interface f_products { [payee: string]: { [product_key: string]: number } }
// export interface f_payments { [payment_key: string]: number }
// export interface f_Sale {
//     sale_id: string;
//     date: string;
//     payees_nbr: number;
//     payments: f_payments;
//     products: f_products;
//     reference?: string;
// }