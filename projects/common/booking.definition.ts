import { BANK_OPERATION_TYPE, FINANCIALS, RECORD_CLASS } from './new_sales.interface';


export interface ACCOUNTING_OPERATION {
    class: RECORD_CLASS;
    bank_operation_type: BANK_OPERATION_TYPE;
    financial_to_credit?: FINANCIALS;
    financial_to_debit?: FINANCIALS;
    nominative: boolean;
}
export const accounting_operations: ACCOUNTING_OPERATION[] = [
    {
        bank_operation_type: BANK_OPERATION_TYPE.asset_emit,
        class: RECORD_CLASS.EXPENSE,
        financial_to_credit: FINANCIALS.ASSET_credit,
        nominative: true,
    },
    {
        bank_operation_type: BANK_OPERATION_TYPE.transfer_emit,
        class: RECORD_CLASS.EXPENSE,
        financial_to_credit: FINANCIALS.BANK_credit,
        nominative: false,
    },
    {
        bank_operation_type: BANK_OPERATION_TYPE.cash_raising,
        class: RECORD_CLASS.OTHER_REVENUE,
        financial_to_debit: FINANCIALS.CASH_debit,
        nominative: false,
    },
    {
        bank_operation_type: BANK_OPERATION_TYPE.cheque_raising,
        class: RECORD_CLASS.OTHER_REVENUE,
        financial_to_debit: FINANCIALS.BANK_debit,
        nominative: false,
    },
    {
        bank_operation_type: BANK_OPERATION_TYPE.cash_deposit,
        class: RECORD_CLASS.MOVEMENT,
        financial_to_credit: FINANCIALS.CASH_credit,
        financial_to_debit: FINANCIALS.BANK_debit,
        nominative: false,
    },
    {
        bank_operation_type: BANK_OPERATION_TYPE.cheque_deposit,
        class: RECORD_CLASS.REVENUE_FROM_MEMBER,
        financial_to_debit: FINANCIALS.BANK_debit,
        nominative: true,
    },

    {
        bank_operation_type: BANK_OPERATION_TYPE.cheque_deposit,
        class: RECORD_CLASS.OTHER_REVENUE,
        financial_to_debit: FINANCIALS.BANK_debit,
        nominative: false,
    },
    {
        bank_operation_type: BANK_OPERATION_TYPE.transfer_receipt,
        class: RECORD_CLASS.OTHER_REVENUE,
        financial_to_debit: FINANCIALS.BANK_debit,
        nominative: false,
    },
    {
        bank_operation_type: BANK_OPERATION_TYPE.transfer_receipt,
        class: RECORD_CLASS.REVENUE_FROM_MEMBER,
        financial_to_debit: FINANCIALS.BANK_debit,
        nominative: true,
    },
    {
        bank_operation_type: BANK_OPERATION_TYPE.cheque_emit,
        class: RECORD_CLASS.EXPENSE,
        financial_to_credit: FINANCIALS.BANK_credit,
        nominative: false,
    },

    {
        bank_operation_type: BANK_OPERATION_TYPE.bank_debiting,
        class: RECORD_CLASS.EXPENSE,
        financial_to_credit: FINANCIALS.BANK_credit,
        nominative: false,
    },
    {
        bank_operation_type: BANK_OPERATION_TYPE.card_payment,
        class: RECORD_CLASS.EXPENSE,
        financial_to_credit: FINANCIALS.BANK_credit,
        nominative: false,
    },
    {
        bank_operation_type: BANK_OPERATION_TYPE.saving_deposit,
        class: RECORD_CLASS.MOVEMENT,
        financial_to_credit: FINANCIALS.BANK_credit,
        financial_to_debit: FINANCIALS.SAVING_debit,
        nominative: false,
    },
    {
        bank_operation_type: BANK_OPERATION_TYPE.saving_withdraw,
        class: RECORD_CLASS.MOVEMENT,
        financial_to_debit: FINANCIALS.BANK_debit,
        financial_to_credit: FINANCIALS.SAVING_credit,
        nominative: false,
    },

]

export function op_id_to_financial_to_credit(op: BANK_OPERATION_TYPE): FINANCIALS {
    let accounts = accounting_operations.find((mapping) => mapping.bank_operation_type === op)!.financial_to_credit;
    if (!accounts) {
        throw new Error(`No credit account found for ${op}`);
    }
    return accounts;
}

export function op_id_to_financial_to_debit(op: BANK_OPERATION_TYPE): FINANCIALS {
    let accounts = accounting_operations.find((mapping) => mapping.bank_operation_type === op)!.financial_to_debit;
    if (!accounts) {
        throw new Error(`No debit account found for ${op}`);
    }
    return accounts;
}

export function get_types_of_class(op_class: RECORD_CLASS): BANK_OPERATION_TYPE[] {
    return accounting_operations
        .filter((mapping) => mapping.class === op_class)
        .map((mapping) => mapping.bank_operation_type);
}

export function get_accounting_operations(op_class: RECORD_CLASS, bank_operation_type: BANK_OPERATION_TYPE): ACCOUNTING_OPERATION {
    let mapping = accounting_operations.find((mapping) => (mapping.bank_operation_type === bank_operation_type) && (mapping.class === op_class));
    if (!mapping) {
        console.log('failing to search for', op_class, bank_operation_type);
        throw new Error(`No mapping found for ${bank_operation_type}`);
    }
    return mapping;
}   