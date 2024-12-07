// export enum SOUS_COMPTES_PRODUITS {
//     client = 'client',
//     tournament = 'droits_de_table',
//     aob = 'autre',
// }

// export enum SOUS_COMPTES_CHARGES {
//     reimbursement = 'remboursement',
//     periodic = 'periodique',
//     other = 'autre',
// }


export enum BANK_LABEL {
    none = 'néant',
    cash_deposit = 'Versement d\'espèces',
    cash_out = 'Retrait d\'espèces',
    cheque_deposit = 'Remise de chèque',
    cheque_emit = 'chèque émis',
    transfer_receipt = 'Virement reçu',
    transfer_emit = 'Virement émis',
    debiting = 'Prélèvement',
    card_payment = 'Paiement par carte',
    saving_deposit = 'Versement sur compte \épargne',
    saving_out = 'Retrait du compte \épargne',
}

export enum OPERATION_TYPE {
    REVENUE = 'REVENUE',
    EXPENSE = 'EXPENSE',
    MOVEMENT = 'MOVEMENT',
}

export enum FINANCIAL_OPERATION {
    CASH_debit = 'cash_in',
    CASH_credit = 'cash_out',
    BANK_debit = 'bank_in',
    BANK_credit = 'bank_out',
    SAVING_debit = 'saving_in',
    SAVING_credit = 'saving_out',
}

export interface Revenue extends Operation { // comptes de produits
    // id?: string;
    // financial_id: string;
    // financial?: Financial;
    season: string;
    date: string;
};

export interface Expense extends Operation {  // comptes de charges
    // id?: string;
    // financial_id: string;
    // financial?: Financial;
    season: string;
    date: string;
};

// export interface Movement {
// }

export interface k_Value {
    [key: string]: number,
}
export type f_Value = {
    [key in FINANCIAL_OPERATION]?: number;
};
export interface Operation {
    label: string;
    operation_type: OPERATION_TYPE;
    amounts: k_Value;
    beneficiary?: string,
}

export interface Financial { // comptes financiers
    id?: string;
    season: string;
    date: string;
    bank_label: BANK_LABEL;

    amounts: f_Value
    operation: Operation[];

    bank_report?: string;

    cheque_ref?: string;
    deposit_ref?: string;
}






export interface f_products { [payee: string]: { [product_key: string]: number } }
export interface f_payments { [payment_key: string]: number }
export interface f_Sale {
    sale_id: string;
    date: string;
    payees_nbr: number;
    payments: f_payments;
    products: f_products;
    reference?: string;
}