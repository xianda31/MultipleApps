import { FINANCIAL_ACCOUNT, BOOK_ENTRY_CLASS, ENTRY_TYPE } from './accounting.interface';


export type Transaction = {
    class: BOOK_ENTRY_CLASS,
    label: string,
    financial_account_to_credit?: FINANCIAL_ACCOUNT,
    financial_account_to_debit?: FINANCIAL_ACCOUNT,
    nominative: boolean,
    deposit: boolean,
    cheque: boolean
};

export const TRANSACTIONS: { [key in ENTRY_TYPE]: Transaction } = {

    // A.  vente à  adhérent ****
    // ****  CLASS = REVENUE_FROM_MEMBER ****

    // paiement en espèces par un adhérent 
    [ENTRY_TYPE.cash_payment]: {
        label: 'paiement en espèces',
        class: BOOK_ENTRY_CLASS.REVENUE_FROM_MEMBER,
        financial_account_to_debit: FINANCIAL_ACCOUNT.CASH_debit,
        nominative: true,
        deposit: false,
        cheque: false,
    },
    // paiement par chèque par un adhérent 
    [ENTRY_TYPE.cheque_payment]: {
        label: 'paiement par chèque',
        class: BOOK_ENTRY_CLASS.REVENUE_FROM_MEMBER,
        financial_account_to_debit: FINANCIAL_ACCOUNT.CASH_debit,
        nominative: true,
        deposit: false,
        cheque: true,
    },
    // vente à crédit (créance) à un adhérent 
    [ENTRY_TYPE.debt_payment]: {
        label: 'paiement à \"crédit\"',
        class: BOOK_ENTRY_CLASS.REVENUE_FROM_MEMBER,
        financial_account_to_debit: FINANCIAL_ACCOUNT.DEBT_debit,
        nominative: true,
        deposit: false,
        cheque: false,
    },
    // paiement par virement par un adhérent
    [ENTRY_TYPE.transfer_payment]: {
        label: 'VIREMENT EN NOTRE FAVEUR',
        class: BOOK_ENTRY_CLASS.REVENUE_FROM_MEMBER,
        financial_account_to_debit: FINANCIAL_ACCOUNT.BANK_debit,
        nominative: true,
        deposit: false,
        cheque: false,
    },

    //B.  vente unitaire à tiers ****
    // ****  CLASS = OTHER_REVENUE ****

    // reception d'espèces de la par d'autres qu'un adhérent 
    [ENTRY_TYPE.cash_receipt]: {
        label: 'paiement en espèces',
        class: BOOK_ENTRY_CLASS.OTHER_REVENUE,
        financial_account_to_debit: FINANCIAL_ACCOUNT.CASH_debit,
        nominative: false,
        deposit: false,
        cheque: false,
    },

    // réception de chèque(s) de la par d'autres qu'un adhérent
    [ENTRY_TYPE.cheque_receipt]: {
        label: 'paiement par chèque',
        class: BOOK_ENTRY_CLASS.OTHER_REVENUE,
        financial_account_to_debit: FINANCIAL_ACCOUNT.BANK_debit,
        nominative: false,
        deposit: false,
        cheque: true,
    },
    // virement en notre faveur reçu d'une autre entité
    // dépot de fonds en chèques (non tracés)
    // [ENTRY_TYPE.cheque_raising]: {
    //     label: 'REMISE DE CHÈQUES',
    //     class: BOOK_ENTRY_CLASS.OTHER_REVENUE,
    //     financial_account_to_debit: FINANCIAL_ACCOUNT.BANK_debit,
    //     nominative: false,
    //     deposit: true,
    //     cheque: false,
    // },
    [ENTRY_TYPE.transfer_receipt]: {
        label: 'VIREMENT EN NOTRE FAVEUR',
        class: BOOK_ENTRY_CLASS.OTHER_REVENUE,
        financial_account_to_debit: FINANCIAL_ACCOUNT.BANK_debit,
        nominative: false,
        deposit: false,
        cheque: false,
    },

    // C. reception groupée de fond de tiers  ****
    // ****  CLASS = OTHER_REVENUE ****

    // dépot de fonds en espèces
    [ENTRY_TYPE.cash_raising]: {
        label: 'VERSEMENT D\'ESPÈCES',
        class: BOOK_ENTRY_CLASS.OTHER_REVENUE,
        financial_account_to_debit: FINANCIAL_ACCOUNT.BANK_debit,
        nominative: false,
        deposit: true,
        cheque: false,
    },

    // D.  mouvements de fonds ****
    // ****  CLASS = MOVEMENT ****

    // dépot d'espèces (de la caisse) en banque
    [ENTRY_TYPE.cash_deposit]: {
        label: 'VERSEMENT D\'ESPÈCES',
        class: BOOK_ENTRY_CLASS.MOVEMENT,
        financial_account_to_credit: FINANCIAL_ACCOUNT.CASH_credit,
        financial_account_to_debit: FINANCIAL_ACCOUNT.BANK_debit,
        nominative: false,
        deposit: true,
        cheque: false,
    },
    // dépot de chèques (receptionnés en caisse) en banque
    [ENTRY_TYPE.cheque_deposit]: {
        label: 'REMISE DE CHÈQUES',
        class: BOOK_ENTRY_CLASS.MOVEMENT,
        financial_account_to_credit: FINANCIAL_ACCOUNT.CASH_credit,
        financial_account_to_debit: FINANCIAL_ACCOUNT.BANK_debit,
        nominative: false,
        deposit: true,
        cheque: false,
    },
    // versement sur compte épargne
    [ENTRY_TYPE.saving_deposit]: {
        label: 'VERSEMENT SUR COMPTE ÉPARGNE',
        class: BOOK_ENTRY_CLASS.MOVEMENT,
        financial_account_to_credit: FINANCIAL_ACCOUNT.BANK_credit,
        financial_account_to_debit: FINANCIAL_ACCOUNT.SAVING_debit,
        nominative: false,
        deposit: false,
        cheque: false,
    },
    // retrait du compte épargne
    [ENTRY_TYPE.saving_withdraw]: {
        label: 'RETRAIT DU COMPTE ÉPARGNE',
        class: BOOK_ENTRY_CLASS.MOVEMENT,
        financial_account_to_debit: FINANCIAL_ACCOUNT.BANK_debit,
        financial_account_to_credit: FINANCIAL_ACCOUNT.SAVING_credit,
        nominative: false,
        deposit: false,
        cheque: false,
    },


    // E. achat , dépenses
    // ****  CLASS = EXPENSE ****

    // émission d'avoir à un adhérent
    [ENTRY_TYPE.asset_emit]: {
        label: 'attribution nominative d\'avoir',
        class: BOOK_ENTRY_CLASS.EXPENSE,
        financial_account_to_credit: FINANCIAL_ACCOUNT.ASSET_credit,
        nominative: true,
        deposit: false,
        cheque: false,
    },
    // paiement par chèque d'une prestation ou service
    [ENTRY_TYPE.cheque_emit]: {
        label: 'CHEQUE EMIS',
        class: BOOK_ENTRY_CLASS.EXPENSE,
        financial_account_to_credit: FINANCIAL_ACCOUNT.BANK_credit,
        nominative: false,
        deposit: false,
        cheque: true,
    },
    // paiement à un tiers d'une prestation ou service par virement
    [ENTRY_TYPE.transfer_emit]: {
        label: 'VIREMENT EMIS',
        class: BOOK_ENTRY_CLASS.EXPENSE,
        financial_account_to_credit: FINANCIAL_ACCOUNT.BANK_credit,
        nominative: false,
        deposit: false,
        cheque: false,
    },
    // paiement par carte bancaire d'une prestation ou de marchandises
    [ENTRY_TYPE.card_payment]: {
        label: 'PAIEMENT PAR CARTE',
        class: BOOK_ENTRY_CLASS.EXPENSE,
        financial_account_to_credit: FINANCIAL_ACCOUNT.BANK_credit,
        nominative: false,
        deposit: false,
        cheque: false,
    },
    // prélèvement sur le compte bancaire par une autre entité
    [ENTRY_TYPE.bank_debiting]: {
        label: 'PRÉLÈVEMENT',
        class: BOOK_ENTRY_CLASS.EXPENSE,
        financial_account_to_credit: FINANCIAL_ACCOUNT.BANK_credit,
        nominative: false,
        deposit: false,
        cheque: false,
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