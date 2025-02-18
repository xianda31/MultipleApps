import { FINANCIAL_ACCOUNT, BOOK_ENTRY_CLASS, ENTRY_TYPE, CUSTOMER_ACCOUNT } from './accounting.interface';

export const _CHEQUE_IN_CASHBOX: boolean = false;     // flag to indicate if cheques are first deposited in cashbox

export const _CHEQUE_IN_ACCOUNT: FINANCIAL_ACCOUNT = _CHEQUE_IN_CASHBOX ? FINANCIAL_ACCOUNT.CASHBOX_debit : FINANCIAL_ACCOUNT.BANK_debit;

export type Account_def = {
    key: FINANCIAL_ACCOUNT | CUSTOMER_ACCOUNT
    label: string
}

export const financial_debits: Account_def[] = [
    { key: FINANCIAL_ACCOUNT.CASHBOX_debit, label: 'Caisse_in' },
    { key: FINANCIAL_ACCOUNT.BANK_debit, label: 'Banque_in' },
    { key: FINANCIAL_ACCOUNT.SAVING_debit, label: 'Epargne_in' },
]
export const financial_credits: Account_def[] = [
    { key: FINANCIAL_ACCOUNT.CASHBOX_credit, label: 'Caisse_out' },
    { key: FINANCIAL_ACCOUNT.BANK_credit, label: 'Banque_out' },
    { key: FINANCIAL_ACCOUNT.SAVING_credit, label: 'Epargne_out' },

]
export const customer_assets: Account_def[] = [
    { key: CUSTOMER_ACCOUNT.ASSET_debit, label: '-AVOIR' },
    { key: CUSTOMER_ACCOUNT.DEBT_credit, label: '+DETTE' },
]
export const customer_debt: Account_def[] = [
    { key: CUSTOMER_ACCOUNT.ASSET_debit, label: '-Avoir' },
    { key: CUSTOMER_ACCOUNT.DEBT_debit, label: 'DETTE' },
]


export type Transaction = {
    class: BOOK_ENTRY_CLASS,
    label: string,
    financial_accounts: Account_def[],
    customer_accounts?: Account_def[],
    financial_accounts_to_charge: Array<FINANCIAL_ACCOUNT | CUSTOMER_ACCOUNT>,
    nominative: boolean,
    is_of_profit_type?: boolean,
    require_deposit_ref: boolean,
    cash: 'in' | 'out' | 'none',
    cheque: 'in' | 'out' | 'none'
};

export const TRANSACTIONS: { [key in ENTRY_TYPE]: Transaction } = {

    // A.  vente à  adhérent ****
    // ****  CLASS = a_REVENUE_FROM_MEMBER ****

    // paiement en espèces par un adhérent 
    [ENTRY_TYPE.payment_in_cash]: {
        label: 'paiement en espèces',
        class: BOOK_ENTRY_CLASS.a_REVENUE_FROM_MEMBER,
        financial_accounts: financial_debits,
        customer_accounts: customer_assets,
        financial_accounts_to_charge: [FINANCIAL_ACCOUNT.CASHBOX_debit],
        nominative: true,
        is_of_profit_type: true,
        require_deposit_ref: false,
        cash: 'in',
        cheque: 'none',
    },
    // paiement par chèque par un adhérent 
    [ENTRY_TYPE.payment_by_cheque]: {
        label: 'paiement par chèque',
        class: BOOK_ENTRY_CLASS.a_REVENUE_FROM_MEMBER,
        financial_accounts: financial_debits,
        customer_accounts: customer_assets,
        financial_accounts_to_charge: _CHEQUE_IN_CASHBOX ? [FINANCIAL_ACCOUNT.CASHBOX_debit] : [FINANCIAL_ACCOUNT.BANK_debit],
        nominative: true,
        is_of_profit_type: true,
        require_deposit_ref: false,
        cash: 'none',
        cheque: 'in',
    },
    // vente à crédit (créance) à un adhérent 
    [ENTRY_TYPE.payment_on_credit]: {
        label: 'paiement à \"crédit\"',
        class: BOOK_ENTRY_CLASS.a_REVENUE_FROM_MEMBER,
        financial_accounts: [],
        customer_accounts: customer_debt,
        financial_accounts_to_charge: [CUSTOMER_ACCOUNT.DEBT_debit],
        nominative: true,
        is_of_profit_type: true,
        require_deposit_ref: false,
        cash: 'none',
        cheque: 'none',
    },
    // paiement par virement par un adhérent
    [ENTRY_TYPE.payment_by_transfer]: {
        label: 'VIREMENT EN NOTRE FAVEUR',
        class: BOOK_ENTRY_CLASS.a_REVENUE_FROM_MEMBER,
        financial_accounts: financial_debits,
        customer_accounts: customer_assets,
        financial_accounts_to_charge: [FINANCIAL_ACCOUNT.BANK_debit],
        nominative: true,
        is_of_profit_type: true,
        require_deposit_ref: false,
        cash: 'none',
        cheque: 'none',
    },

    //B.  vente unitaire à tiers ****
    // ****  CLASS = c_OTHER_REVENUE ****

    // reception d'espèces de la par d'autres qu'un adhérent 
    [ENTRY_TYPE.cash_receipt]: {
        label: 'paiement en espèces',
        class: BOOK_ENTRY_CLASS.c_OTHER_REVENUE,
        financial_accounts: financial_debits,
        financial_accounts_to_charge: [FINANCIAL_ACCOUNT.CASHBOX_debit],
        nominative: false,
        is_of_profit_type: true,
        require_deposit_ref: false,
        cash: 'in',
        cheque: 'none',
    },

    // réception de chèque(s) de la par d'autres qu'un adhérent
    [ENTRY_TYPE.cheque_receipt]: {
        label: 'paiement par chèque',
        class: BOOK_ENTRY_CLASS.c_OTHER_REVENUE,
        financial_accounts: financial_debits,
        financial_accounts_to_charge: _CHEQUE_IN_CASHBOX ? [FINANCIAL_ACCOUNT.CASHBOX_debit] : [FINANCIAL_ACCOUNT.BANK_debit],
        nominative: false,
        is_of_profit_type: true,
        require_deposit_ref: false,
        cash: 'none',
        cheque: 'in',
    },
    [ENTRY_TYPE.transfer_receipt]: {
        label: 'VIREMENT EN NOTRE FAVEUR',
        class: BOOK_ENTRY_CLASS.c_OTHER_REVENUE,
        financial_accounts: financial_debits,
        financial_accounts_to_charge: [FINANCIAL_ACCOUNT.BANK_debit],
        nominative: false,
        is_of_profit_type: true,
        require_deposit_ref: false,
        cash: 'none',
        cheque: 'none',
    },

    // C. depense pour adhérent ****
    // ****  CLASS = EXPENS_FOR_MEMBER ****

    // émission d'avoir à un adhérent
    [ENTRY_TYPE.asset_emit]: {
        label: 'attribution nominative d\'avoir',
        class: BOOK_ENTRY_CLASS.d_EXPENSE_FOR_MEMBER,
        financial_accounts: [],
        customer_accounts: [{ key: CUSTOMER_ACCOUNT.ASSET_credit, label: 'Avoir' }],
        financial_accounts_to_charge: [CUSTOMER_ACCOUNT.ASSET_credit],
        nominative: true,
        is_of_profit_type: false,
        require_deposit_ref: false,
        cash: 'none',
        cheque: 'none',
    },

    // D. reception groupée de fond de tiers  ****
    // ****  CLASS = c_OTHER_REVENUE ****

    // dépot de fonds en espèces
    [ENTRY_TYPE.cash_raising]: {
        label: 'VERSEMENT D\'ESPÈCES',
        class: BOOK_ENTRY_CLASS.c_OTHER_REVENUE,
        financial_accounts: financial_debits,
        financial_accounts_to_charge: [FINANCIAL_ACCOUNT.BANK_debit],
        nominative: false,
        is_of_profit_type: true,
        require_deposit_ref: true,
        cash: 'none',
        cheque: 'none',
    },

    // virement en notre faveur reçu d'une autre entité
    // dépot de fonds en chèques (non tracés)
    [ENTRY_TYPE.cheques_raising]: {
        label: 'REMISE DE CHÈQUES',
        class: BOOK_ENTRY_CLASS.c_OTHER_REVENUE,
        financial_accounts: financial_debits,
        financial_accounts_to_charge: [FINANCIAL_ACCOUNT.BANK_debit],
        nominative: false,
        is_of_profit_type: true,
        require_deposit_ref: true,
        cash: 'none',
        cheque: 'none',
    },
    // E.  mouvements de fonds ****
    // ****  CLASS = e_MOVEMENT ****

    // dépot d'espèces (de la caisse) en banque
    [ENTRY_TYPE.cash_deposit]: {
        label: 'VERSEMENT D\'ESPÈCES',
        class: BOOK_ENTRY_CLASS.e_MOVEMENT,
        financial_accounts: [...financial_credits, ...financial_debits],
        financial_accounts_to_charge: [FINANCIAL_ACCOUNT.CASHBOX_credit, FINANCIAL_ACCOUNT.BANK_debit],
        nominative: false,
        require_deposit_ref: true,
        cash: 'out',
        cheque: 'none',
    },
    // dépot de chèques (receptionnés en caisse) en banque
    [ENTRY_TYPE.cheque_deposit]: {
        label: 'REMISE DE CHÈQUES',
        class: BOOK_ENTRY_CLASS.e_MOVEMENT,
        financial_accounts: [...financial_credits, ...financial_debits],
        // profit_and_loss_accounts: FINANCIAL_ACCOUNT.BANK_debit,
        financial_accounts_to_charge: [FINANCIAL_ACCOUNT.CASHBOX_credit, FINANCIAL_ACCOUNT.BANK_debit],
        nominative: false,
        require_deposit_ref: true,
        cash: 'none',
        cheque: 'none',
    },
    // versement sur compte épargne
    [ENTRY_TYPE.saving_deposit]: {
        label: 'VERSEMENT SUR COMPTE ÉPARGNE',
        class: BOOK_ENTRY_CLASS.e_MOVEMENT,
        financial_accounts: [...financial_credits, ...financial_debits],
        // profit_and_loss_accounts: FINANCIAL_ACCOUNT.SAVING_debit,
        financial_accounts_to_charge: [FINANCIAL_ACCOUNT.BANK_credit, FINANCIAL_ACCOUNT.SAVING_debit],
        nominative: false,
        require_deposit_ref: false,
        cash: 'none',
        cheque: 'none',
    },
    // retrait du compte épargne
    [ENTRY_TYPE.saving_withdraw]: {
        label: 'RETRAIT DU COMPTE ÉPARGNE',
        class: BOOK_ENTRY_CLASS.e_MOVEMENT,
        // profit_and_loss_accounts: FINANCIAL_ACCOUNT.BANK_debit,
        financial_accounts: [...financial_credits, ...financial_debits],
        financial_accounts_to_charge: [FINANCIAL_ACCOUNT.BANK_credit, FINANCIAL_ACCOUNT.SAVING_debit],
        nominative: false,
        require_deposit_ref: false,
        cash: 'none',
        cheque: 'none',
    },


    // F. achat , dépenses
    // ****  CLASS = EXPENSE ****

    // paiement par chèque d'une prestation ou service
    [ENTRY_TYPE.cheque_emit]: {
        label: 'CHEQUE EMIS',
        class: BOOK_ENTRY_CLASS.b_OTHER_EXPENSE,
        financial_accounts: financial_credits,
        financial_accounts_to_charge: [FINANCIAL_ACCOUNT.CASHBOX_debit],
        nominative: false,
        is_of_profit_type: false,
        require_deposit_ref: false,
        cash: 'none',
        cheque: 'out',
    },
    // paiement à un tiers d'une prestation ou service par virement
    [ENTRY_TYPE.transfer_emit]: {
        label: 'VIREMENT EMIS',
        class: BOOK_ENTRY_CLASS.b_OTHER_EXPENSE,
        financial_accounts: financial_credits,
        financial_accounts_to_charge: [FINANCIAL_ACCOUNT.CASHBOX_debit],
        nominative: false,
        is_of_profit_type: false,
        require_deposit_ref: false,
        cash: 'none',
        cheque: 'none',
    },
    // paiement par carte bancaire d'une prestation ou de marchandises
    [ENTRY_TYPE.card_payment]: {
        label: 'PAIEMENT PAR CARTE',
        class: BOOK_ENTRY_CLASS.b_OTHER_EXPENSE,
        financial_accounts: financial_credits,
        financial_accounts_to_charge: [FINANCIAL_ACCOUNT.CASHBOX_debit],
        nominative: false,
        is_of_profit_type: false,
        require_deposit_ref: false,
        cash: 'none',
        cheque: 'none',
    },
    // prélèvement sur le compte bancaire par une autre entité
    [ENTRY_TYPE.bank_debiting]: {
        label: 'PRÉLÈVEMENT',
        class: BOOK_ENTRY_CLASS.b_OTHER_EXPENSE,
        financial_accounts: financial_credits,
        financial_accounts_to_charge: [FINANCIAL_ACCOUNT.CASHBOX_debit],
        nominative: false,
        is_of_profit_type: false,
        require_deposit_ref: false,
        cash: 'none',
        cheque: 'none',
    },



}



export function class_types(op_class: BOOK_ENTRY_CLASS): ENTRY_TYPE[] {
    return Object.entries(TRANSACTIONS)
        .filter(([, mapping]) => mapping.class === op_class)
        .map(([entryType]) => entryType as ENTRY_TYPE);
}

export function get_transaction(entry_type: ENTRY_TYPE): Transaction {
    return TRANSACTIONS[entry_type];
}   