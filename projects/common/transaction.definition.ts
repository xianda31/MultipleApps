import { BANK_OPERATION_TYPE, FINANCIAL_ACCOUNTS, RECORD_CLASS } from './accounting.interface';


export interface Transaction {
    class: RECORD_CLASS;
    bank_operation_type: BANK_OPERATION_TYPE;
    account_to_credit?: FINANCIAL_ACCOUNTS;
    account_to_debit?: FINANCIAL_ACCOUNTS;
    nominative: boolean;
}
export const TRANSACTIONS: Transaction[] = [
    {
        bank_operation_type: BANK_OPERATION_TYPE.asset_emit,
        class: RECORD_CLASS.EXPENSE,
        account_to_credit: FINANCIAL_ACCOUNTS.ASSET_credit,
        nominative: true,
    },
    {
        bank_operation_type: BANK_OPERATION_TYPE.transfer_emit,
        class: RECORD_CLASS.EXPENSE,
        account_to_credit: FINANCIAL_ACCOUNTS.BANK_credit,
        nominative: false,
    },
    {
        bank_operation_type: BANK_OPERATION_TYPE.cash_raising,
        class: RECORD_CLASS.OTHER_REVENUE,
        account_to_debit: FINANCIAL_ACCOUNTS.CASH_debit,
        nominative: false,
    },
    {
        bank_operation_type: BANK_OPERATION_TYPE.cheque_raising,
        class: RECORD_CLASS.OTHER_REVENUE,
        account_to_debit: FINANCIAL_ACCOUNTS.BANK_debit,
        nominative: false,
    },
    {
        bank_operation_type: BANK_OPERATION_TYPE.cash_deposit,
        class: RECORD_CLASS.MOVEMENT,
        account_to_credit: FINANCIAL_ACCOUNTS.CASH_credit,
        account_to_debit: FINANCIAL_ACCOUNTS.BANK_debit,
        nominative: false,
    },
    {
        bank_operation_type: BANK_OPERATION_TYPE.cheque_deposit,
        class: RECORD_CLASS.REVENUE_FROM_MEMBER,
        account_to_debit: FINANCIAL_ACCOUNTS.BANK_debit,
        nominative: true,
    },
    {
        bank_operation_type: BANK_OPERATION_TYPE.cash_received,
        class: RECORD_CLASS.REVENUE_FROM_MEMBER,
        account_to_debit: FINANCIAL_ACCOUNTS.CASH_debit,
        nominative: true,
    },
    {
        bank_operation_type: BANK_OPERATION_TYPE.cheque_deposit,
        class: RECORD_CLASS.OTHER_REVENUE,
        account_to_debit: FINANCIAL_ACCOUNTS.BANK_debit,
        nominative: false,
    },
    {
        bank_operation_type: BANK_OPERATION_TYPE.transfer_receipt,
        class: RECORD_CLASS.OTHER_REVENUE,
        account_to_debit: FINANCIAL_ACCOUNTS.BANK_debit,
        nominative: false,
    },
    {
        bank_operation_type: BANK_OPERATION_TYPE.transfer_receipt,
        class: RECORD_CLASS.REVENUE_FROM_MEMBER,
        account_to_debit: FINANCIAL_ACCOUNTS.BANK_debit,
        nominative: true,
    },
    {
        bank_operation_type: BANK_OPERATION_TYPE.cheque_emit,
        class: RECORD_CLASS.EXPENSE,
        account_to_credit: FINANCIAL_ACCOUNTS.BANK_credit,
        nominative: false,
    },

    {
        bank_operation_type: BANK_OPERATION_TYPE.bank_debiting,
        class: RECORD_CLASS.EXPENSE,
        account_to_credit: FINANCIAL_ACCOUNTS.BANK_credit,
        nominative: false,
    },
    {
        bank_operation_type: BANK_OPERATION_TYPE.card_payment,
        class: RECORD_CLASS.EXPENSE,
        account_to_credit: FINANCIAL_ACCOUNTS.BANK_credit,
        nominative: false,
    },
    {
        bank_operation_type: BANK_OPERATION_TYPE.saving_deposit,
        class: RECORD_CLASS.MOVEMENT,
        account_to_credit: FINANCIAL_ACCOUNTS.BANK_credit,
        account_to_debit: FINANCIAL_ACCOUNTS.SAVING_debit,
        nominative: false,
    },
    {
        bank_operation_type: BANK_OPERATION_TYPE.saving_withdraw,
        class: RECORD_CLASS.MOVEMENT,
        account_to_debit: FINANCIAL_ACCOUNTS.BANK_debit,
        account_to_credit: FINANCIAL_ACCOUNTS.SAVING_credit,
        nominative: false,
    },

]

// export function bank_op_type_2_account_to_credit(op: BANK_OPERATION_TYPE): FINANCIAL_ACCOUNTS {
//     let accounts = TRANSACTIONS.find((mapping) => mapping.bank_operation_type === op)!.account_to_credit;
//     if (!accounts) {
//         throw new Error(`No credit account found for ${op}`);
//     }
//     return accounts;
// }

// export function bank_op_type_2_account_to_debit(op: BANK_OPERATION_TYPE): FINANCIAL_ACCOUNTS {
//     let accounts = TRANSACTIONS.find((mapping) => mapping.bank_operation_type === op)!.account_to_debit;
//     if (!accounts) {
//         throw new Error(`No debit account found for ${op}`);
//     }
//     return accounts;
// }

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