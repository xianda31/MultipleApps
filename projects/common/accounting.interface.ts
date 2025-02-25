export enum ENTRY_TYPE {
    payment_in_cash = 'payment_in_cash',
    payment_by_cheque = 'payment_by_cheque',
    payment_on_credit = 'payment_on_credit',
    payment_by_transfer = 'payment_by_transfer',
    cash_receipt = 'cash_receipt',
    cheque_receipt = 'cheque_receipt',
    transfer_receipt = 'transfer_receipt',
    cash_raising = 'cash_raising',
    cheques_raising = 'cheques_raising',
    cash_deposit = 'cash_deposit',
    cheque_deposit = 'cheque_deposit',
    saving_deposit = 'saving_deposit',
    saving_withdraw = 'saving_withdraw',
    asset_emit = 'asset_emit',
    cheque_emit = 'cheque_emit',
    transfer_emit = 'transfer_emit',
    card_payment = 'card_payment',
    bank_debiting = 'bank_debiting',

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
    [FINANCIAL_ACCOUNT.SAVING_debit]: 'saving_in',
    [FINANCIAL_ACCOUNT.SAVING_credit]: 'saving_out',
}
export const Cashbox_accounts: { [key in Partial<FINANCIAL_ACCOUNT>]?: string } = {
    [FINANCIAL_ACCOUNT.CASHBOX_debit]: 'cashbox_in',
    [FINANCIAL_ACCOUNT.CASHBOX_credit]: 'cashbox_out',
}



export enum BOOK_ENTRY_CLASS {
    a_REVENUE_FROM_MEMBER = 'vente adhérent',
    b_OTHER_EXPENSE = 'toutes dépenses',
    c_OTHER_REVENUE = 'recettes hors vente adhérent',
    d_EXPENSE_FOR_MEMBER = 'dépense adhérent',
    e_MOVEMENT = 'mouvement bancaire',
}

export type operation_values = { [key: string]: number };
export interface Operation {
    label?: string;          // libellé de l'opération 
    member?: string;        // nom de l'adhérent
    values: operation_values;
}

export interface Session {
    season: string;
    // vendor: string;
    date: string;
}
export interface Revenue extends Operation, Session {
    id: string;
}// comptes de produits
export interface Expense extends Operation, Session {
    id: string;
}; // comptes de charges


export type bank_values = { [key in FINANCIAL_ACCOUNT]?: number; };


export interface BookEntry {
    id: string;
    updatedAt?: string;
    season: string;
    date: string;
    tag?: string;
    class: BOOK_ENTRY_CLASS;
    bank_op_type: ENTRY_TYPE;   // type d'opération bancaire
    amounts: bank_values
    cheque_ref?: string;        // code banque + numéro de chèque
    bank_report?: string | null;       // (mois) relevé bancaire
    deposit_ref?: string;       //  référence bordereau de dépôt
    operations: Operation[];
}



