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


export enum OPERATION_LABEL {
    cash_in = 'Versement d\'espèces',
    cash_out = 'Retrait d\'espèces',
    cheque_in = 'Remise de chèque',
    cheque_out = 'chèque émis',
    transfer_in = 'Virement reçu',
    transfer_out = 'Virement émis',
    debiting = 'Prélèvement',
    card_out = 'Paiement par carte',
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
    id?: string;
    financial_id: string;
    financial?: Financial;
};

export interface Expense extends Operation {  // comptes de charges
    id?: string;
    financial_id: string;
    financial?: Financial;
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
    amounts: k_Value;
    // sub_account: SOUS_COMPTES_PRODUITS | SOUS_COMPTES_CHARGES,
    beneficiary?: string,
}

export interface Financial { // comptes financiers
    id?: string;
    season: string;
    date: string;
    type: OPERATION_LABEL;

    amounts: f_Value

    revenues?: Revenue[];
    expense?: Expense;
    c2b?: string;

    cheque_ref?: string;
    deposit_ref?: string;
    bank_report?: string;
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