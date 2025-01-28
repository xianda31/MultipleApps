export enum ENTRY_TYPE {
    cash_payment = 'cash_payment',
    cheque_payment = 'cheque_payment',
    debt_payment = 'debt_payment',
    transfer_payment = 'transfer_payment',
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

// export enum BOOK_ENTRY_TYPE {

//     // vente à adhérent
//     cash_payment = 'paiement en espèces',
//     cheque_payment = 'paiement par chèque',
//     debt_payment = 'paiement par créance',
//     transfer_payment = 'paiement par virement',

//     //B.  vente unitaire à tiers
//     cash_receipt = 'paiement en espèces',               // ex. droit de table
//     cheque_receipt = 'paiement par chèque',               // ex. participation d'un invité,d'un autre club
//     transfer_receipt = 'paiement par virement',          // ex. participation d'un invité,d'un autre

//     //C. reception groupée de fond de tiers
//     cash_raising = 'dépot de fonds levés en espèces',
//     cheque_raising = 'dépot de fonds levés en chèques',

//     // D.  mouvements de fonds
//     cash_deposit = 'dépot d\'espèces',
//     cheque_deposit = 'dépot de chèque en banque',
//     saving_deposit = 'versement compte \épargne',
//     saving_withdraw = 'retrait compte \épargne',

//     // debt_emit = 'émission de créance',
//     // asset_receipt = 'paiement par avoir',
//     // cash_withdraw = 'retrait d\'espèces',   // pour l'instant non permis !!

//     // E. achat , dépenses
//     asset_emit = 'émission d\'avoir',
//     cheque_emit = 'achat par chèque',
//     transfer_emit = 'achat par virement',
//     card_payment = 'achat par carte',
//     bank_debiting = 'prélèvement',

// }

export enum FINANCIAL_ACCOUNT {
    CASH_debit = 'cashbox_in',
    BANK_debit = 'bank_in',
    ASSET_debit = 'avoir_in',
    DEBT_debit = 'creance_in',
    SAVING_debit = 'saving_in',

    CASH_credit = 'cashbox_out',
    BANK_credit = 'bank_out',
    ASSET_credit = 'avoir_out',
    DEBT_credit = 'creance_out',
    SAVING_credit = 'saving_out',
}



export enum BOOK_ENTRY_CLASS {
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


export type bank_values = { [key in FINANCIAL_ACCOUNT]?: number; };


export interface Bookentry {
    id: string;
    updatedAt?: string;
    season: string;
    date: string;
    class: BOOK_ENTRY_CLASS;
    bank_op_type: ENTRY_TYPE;   // type d'opération bancaire
    amounts: bank_values
    cheque_ref?: string;        // code banque + numéro de chèque
    bank_report?: string;       // (mois) relevé bancaire
    deposit_ref?: string;       //  référence bordereau de dépôt
    operations: Operation[];
}

export function season(date: Date): string {
    const month = date.getMonth();
    const year = date.getFullYear();
    if (month < 7) return `${year - 1}/${year}`;
    return `${year}/${year + 1}`;
}

