import { BANK_OPERATION_TYPE, FINANCIAL_ACCOUNTS, RECORD_CLASS } from './accounting.interface';


export interface Transaction {
    class: RECORD_CLASS;
    bank_operation_type: BANK_OPERATION_TYPE;
    account_to_credit?: FINANCIAL_ACCOUNTS;
    account_to_debit?: FINANCIAL_ACCOUNTS;
    nominative: boolean;
}
export const TRANSACTIONS: Transaction[] = [
    // émission d'avoir à un adhérent
    {
        bank_operation_type: BANK_OPERATION_TYPE.asset_emit,
        class: RECORD_CLASS.EXPENSE,
        account_to_credit: FINANCIAL_ACCOUNTS.ASSET_credit,
        nominative: true,
    },
    // paiement d'une prestation ou service par virement
    {
        bank_operation_type: BANK_OPERATION_TYPE.transfer_emit,
        class: RECORD_CLASS.EXPENSE,
        account_to_credit: FINANCIAL_ACCOUNTS.BANK_credit,
        nominative: false,
    },
    // dépot de fonds en espèces
    {
        bank_operation_type: BANK_OPERATION_TYPE.cash_raising,
        class: RECORD_CLASS.OTHER_REVENUE,
        account_to_debit: FINANCIAL_ACCOUNTS.CASH_debit,
        nominative: false,
    },
    // dépot de fonds en chèques (non nominatifs)
    {
        bank_operation_type: BANK_OPERATION_TYPE.cheque_raising,
        class: RECORD_CLASS.OTHER_REVENUE,
        account_to_debit: FINANCIAL_ACCOUNTS.BANK_debit,
        nominative: false,
    },
    // dépot d'espèces (de la caisse) en banque
    {
        bank_operation_type: BANK_OPERATION_TYPE.cash_deposit,
        class: RECORD_CLASS.MOVEMENT,
        account_to_credit: FINANCIAL_ACCOUNTS.CASH_credit,
        account_to_debit: FINANCIAL_ACCOUNTS.BANK_debit,
        nominative: false,
    },
    // réception de chèque adhérent (traçable)
    {
        bank_operation_type: BANK_OPERATION_TYPE.cheque_receipt,
        class: RECORD_CLASS.REVENUE_FROM_MEMBER,
        account_to_debit: FINANCIAL_ACCOUNTS.CASH_debit,   // was BANK_debit
        nominative: true,
    },
    // dépot de chèque (receptionné en caisse) en banque
    {
        bank_operation_type: BANK_OPERATION_TYPE.cheque_deposit,
        class: RECORD_CLASS.MOVEMENT,
        account_to_credit: FINANCIAL_ACCOUNTS.CASH_credit,
        account_to_debit: FINANCIAL_ACCOUNTS.BANK_debit,
        nominative: false,
    },
    // reception d'espèces de la par des adhérents 
    {
        bank_operation_type: BANK_OPERATION_TYPE.cash_receipt,
        class: RECORD_CLASS.REVENUE_FROM_MEMBER,
        account_to_debit: FINANCIAL_ACCOUNTS.CASH_debit,
        nominative: true,
    },
    // virement en notre faveur reçu d'une autre entité
    {
        bank_operation_type: BANK_OPERATION_TYPE.transfer_receipt,
        class: RECORD_CLASS.OTHER_REVENUE,
        account_to_debit: FINANCIAL_ACCOUNTS.BANK_debit,
        nominative: false,
    },
    // virement reçu d'un adhérent
    {
        bank_operation_type: BANK_OPERATION_TYPE.transfer_receipt,
        class: RECORD_CLASS.REVENUE_FROM_MEMBER,
        account_to_debit: FINANCIAL_ACCOUNTS.BANK_debit,
        nominative: true,
    },
    // paiement par chèque d'une prestation ou service
    {
        bank_operation_type: BANK_OPERATION_TYPE.cheque_emit,
        class: RECORD_CLASS.EXPENSE,
        account_to_credit: FINANCIAL_ACCOUNTS.BANK_credit,
        nominative: false,
    },
    // prélèvement sur le compte bancaire par une autre entité
    {
        bank_operation_type: BANK_OPERATION_TYPE.bank_debiting,
        class: RECORD_CLASS.EXPENSE,
        account_to_credit: FINANCIAL_ACCOUNTS.BANK_credit,
        nominative: false,
    },
    // paiement par carte bancaire d'une prestation ou de marchandises
    {
        bank_operation_type: BANK_OPERATION_TYPE.card_payment,
        class: RECORD_CLASS.EXPENSE,
        account_to_credit: FINANCIAL_ACCOUNTS.BANK_credit,
        nominative: false,
    },
    // versement sur compte épargne
    {
        bank_operation_type: BANK_OPERATION_TYPE.saving_deposit,
        class: RECORD_CLASS.MOVEMENT,
        account_to_credit: FINANCIAL_ACCOUNTS.BANK_credit,
        account_to_debit: FINANCIAL_ACCOUNTS.SAVING_debit,
        nominative: false,
    },
    // retrait du compte épargne
    {
        bank_operation_type: BANK_OPERATION_TYPE.saving_withdraw,
        class: RECORD_CLASS.MOVEMENT,
        account_to_debit: FINANCIAL_ACCOUNTS.BANK_debit,
        account_to_credit: FINANCIAL_ACCOUNTS.SAVING_credit,
        nominative: false,
    },

]



export function bank_op_types_for_class(op_class: RECORD_CLASS): BANK_OPERATION_TYPE[] {
    return TRANSACTIONS
        .filter((mapping) => mapping.class === op_class)
        .map((mapping) => mapping.bank_operation_type);
}

export function get_transaction(op_class: RECORD_CLASS, bank_operation_type: BANK_OPERATION_TYPE): Transaction {
    let mapping = TRANSACTIONS.find((mapping) => (mapping.bank_operation_type === bank_operation_type) && (mapping.class === op_class));
    if (!mapping) {
        console.log('failing to search for', op_class, bank_operation_type);
        throw new Error(`No transaction allowed for ${op_class} ${bank_operation_type}`);
    }
    return mapping;
}   