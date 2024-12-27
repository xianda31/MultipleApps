
export enum BANK_OP_TYPE {
    none = 'néant',
    cash_deposit = 'versement d\'espèces',
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

export enum PaymentMode {
    CASH = 'espèces',
    CHEQUE = 'chèque',
    TRANSFER = 'virement',
    CREDIT = 'crédit',
    ASSETS = 'avoir',
    // CARD = 'carte',
}

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
    NaN = 'NaN'                      // pour les opérations non financières
}

export enum OPERATION_CLASS {
    REVENUE_FROM_MEMBER = 'vente adhérent',
    OTHER_REVENUE = 'recettes hors vente adhérent',
    EXPENSE = 'toutes dépenses',
    MOVEMENT = 'mouvement bancaire',
}

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


export type op_Value = { [key in PRODUCTS_ACCOUNTS | EXPENSES_ACCOUNTS]?: number };
export interface Operation {
    label: string;          // libellé de l'opération ; nom de l'adhérent si vente adhérent
    class: OPERATION_CLASS;
    values: op_Value;
}

export interface Session {
    season: string;
    // vendor: string;
    date: string;
}
export interface Revenue extends Operation, Session { }// comptes de produits
export interface Expense extends Operation, Session { }; // comptes de charges


export type f_Value = { [key in FINANCIALS]?: number; };
export interface BankStatement {
    season: string;
    date: string;
    amounts: f_Value
    bank_op_type: BANK_OP_TYPE;   // type d'opération bancaire
    bank_report?: string;       // (mois) relevé bancaire
    cheque_ref?: string;        // code banque + numéro de chèque
    deposit_ref?: string;       //  référence bordereau de dépôt
}
export interface Financial extends BankStatement { // comptes financiers
    id?: string;
    operations: Operation[];
}

export function season(date: Date): string {
    const month = date.getMonth();
    const year = date.getFullYear();
    if (month < 7) return `${year - 1}/${year}`;
    return `${year}/${year + 1}`;
}

export function financial_of_bank_op_type(op: BANK_OP_TYPE): FINANCIALS {
    const BANK_OP_TYPE_2_FINANCIAL_ACCOUNTS: { [key in BANK_OP_TYPE]: FINANCIALS } = {
        [BANK_OP_TYPE.cash_deposit]: FINANCIALS.CASH_debit,
        [BANK_OP_TYPE.cash_withdraw]: FINANCIALS.CASH_credit, // pour l'instant non permis !!
        [BANK_OP_TYPE.cheque_deposit]: FINANCIALS.BANK_debit,
        [BANK_OP_TYPE.cheque_emit]: FINANCIALS.BANK_credit,
        [BANK_OP_TYPE.transfer_receipt]: FINANCIALS.BANK_debit,
        [BANK_OP_TYPE.transfer_emit]: FINANCIALS.BANK_credit,
        [BANK_OP_TYPE.bank_debiting]: FINANCIALS.BANK_credit,
        [BANK_OP_TYPE.card_payment]: FINANCIALS.BANK_credit,
        [BANK_OP_TYPE.saving_deposit]: FINANCIALS.SAVING_debit,
        [BANK_OP_TYPE.saving_withdraw]: FINANCIALS.SAVING_credit,
        [BANK_OP_TYPE.none]: FINANCIALS.NaN
    }
    return BANK_OP_TYPE_2_FINANCIAL_ACCOUNTS[op];
}

export function bank_op_types_for_op_class(op_class: OPERATION_CLASS): BANK_OP_TYPE[] {
    switch (op_class) {
        case OPERATION_CLASS.OTHER_REVENUE:
            return [BANK_OP_TYPE.cheque_deposit, BANK_OP_TYPE.transfer_receipt];
        case OPERATION_CLASS.EXPENSE:
            return [BANK_OP_TYPE.cheque_emit, BANK_OP_TYPE.transfer_emit, BANK_OP_TYPE.bank_debiting, BANK_OP_TYPE.card_payment];
        case OPERATION_CLASS.MOVEMENT:
            return [BANK_OP_TYPE.cash_deposit, BANK_OP_TYPE.saving_deposit, BANK_OP_TYPE.saving_withdraw];
        default:
            return [];
    }
}
