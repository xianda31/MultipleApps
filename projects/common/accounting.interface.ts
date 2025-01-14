export enum BANK_OPERATION_TYPE {

    cash_received = 'paiement en espèces',

    asset_emit = 'émission d\'avoir',

    // asset_receipt = 'réception d\'avoir',   
    // debt_emit = 'émission de créance',
    // debt_receipt = 'réception de créance',

    cash_raising = 'collecte de fonds en espèces',
    cheque_raising = 'collecte de fonds en chèques',
    cash_deposit = 'dépot d\'espèces',
    cheque_deposit = 'réception de chèque',
    transfer_receipt = 'virement reçu',

    cash_withdraw = 'retrait d\'espèces',   // pour l'instant non permis !!

    cheque_emit = 'paiement par chèque',
    transfer_emit = 'paiement par virement',
    bank_debiting = 'prélèvement',
    card_payment = 'paiement par carte',

    saving_deposit = 'versement compte \épargne',
    saving_withdraw = 'retrait compte \épargne',
}



export enum FINANCIAL_ACCOUNTS {
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
    // NaN = 'NaN'                      // pour les opérations non financières
}

export enum RECORD_CLASS {
    REVENUE_FROM_MEMBER = 'vente adhérent',
    OTHER_REVENUE = 'recettes hors vente adhérent',
    EXPENSE = 'toutes dépenses',
    MOVEMENT = 'mouvement bancaire',
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


export type bank_values = { [key in FINANCIAL_ACCOUNTS]?: number; };
export interface BankStatement {
    season: string;
    date: string;
    bank_op_type: BANK_OPERATION_TYPE;   // type d'opération bancaire
    amounts: bank_values
    cheque_ref?: string;        // code banque + numéro de chèque
    bank_report?: string;       // (mois) relevé bancaire
    deposit_ref?: string;       //  référence bordereau de dépôt
}
export interface Bookentry extends BankStatement { // comptes financiers
    id: string;
    class: RECORD_CLASS;
    operations: Operation[];
}

export function season(date: Date): string {
    const month = date.getMonth();
    const year = date.getFullYear();
    if (month < 7) return `${year - 1}/${year}`;
    return `${year}/${year + 1}`;
}

