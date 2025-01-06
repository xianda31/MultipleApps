import { BOOKING_ID, FINANCIALS, OPERATION_CLASS } from "./new_sales.interface";


export interface Booking_mapping {
    class: OPERATION_CLASS;
    id: BOOKING_ID;
    financial_to_credit?: FINANCIALS;
    financial_to_debit?: FINANCIALS;
    nominative: boolean;
}
export const booking_mapping: Booking_mapping[] = [
    {
        id: BOOKING_ID.asset_emit,
        class: OPERATION_CLASS.EXPENSE,
        financial_to_credit: FINANCIALS.ASSET_credit,
        nominative: true,
    },
    {
        id: BOOKING_ID.cash_raising,
        class: OPERATION_CLASS.OTHER_REVENUE,
        financial_to_debit: FINANCIALS.CASH_debit,
        nominative: false,
    },
    {
        id: BOOKING_ID.cheque_raising,
        class: OPERATION_CLASS.OTHER_REVENUE,
        financial_to_debit: FINANCIALS.BANK_debit,
        nominative: false,
    },
    {
        id: BOOKING_ID.cash_deposit,
        class: OPERATION_CLASS.MOVEMENT,
        financial_to_credit: FINANCIALS.CASH_credit,
        financial_to_debit: FINANCIALS.BANK_debit,
        nominative: false,
    },
    {
        id: BOOKING_ID.cheque_deposit,
        class: OPERATION_CLASS.OTHER_REVENUE,
        financial_to_debit: FINANCIALS.BANK_debit,
        nominative: false,
    },
    {
        id: BOOKING_ID.transfer_receipt,
        class: OPERATION_CLASS.OTHER_REVENUE,
        financial_to_debit: FINANCIALS.BANK_debit,
        nominative: false,
    },

    {
        id: BOOKING_ID.cheque_emit,
        class: OPERATION_CLASS.EXPENSE,
        financial_to_credit: FINANCIALS.BANK_credit,
        nominative: false,
    },

    {
        id: BOOKING_ID.bank_debiting,
        class: OPERATION_CLASS.EXPENSE,
        financial_to_credit: FINANCIALS.BANK_credit,
        nominative: false,
    },
    {
        id: BOOKING_ID.card_payment,
        class: OPERATION_CLASS.EXPENSE,
        financial_to_credit: FINANCIALS.BANK_credit,
        nominative: false,
    },
    {
        id: BOOKING_ID.saving_deposit,
        class: OPERATION_CLASS.MOVEMENT,
        financial_to_credit: FINANCIALS.BANK_credit,
        financial_to_debit: FINANCIALS.SAVING_debit,
        nominative: false,
    },
    {
        id: BOOKING_ID.saving_withdraw,
        class: OPERATION_CLASS.MOVEMENT,
        financial_to_debit: FINANCIALS.BANK_debit,
        financial_to_credit: FINANCIALS.SAVING_credit,
        nominative: false,
    },

]

export function op_id_to_financial_to_credit(op: BOOKING_ID): FINANCIALS {
    let accounts = booking_mapping.find((mapping) => mapping.id === op)!.financial_to_credit;
    if (!accounts) {
        throw new Error(`No credit account found for ${op}`);
    }
    return accounts;
}

export function op_id_to_financial_to_debit(op: BOOKING_ID): FINANCIALS {
    let accounts = booking_mapping.find((mapping) => mapping.id === op)!.financial_to_debit;
    if (!accounts) {
        throw new Error(`No debit account found for ${op}`);
    }
    return accounts;
}

export function get_bookings_of_class(op_class: OPERATION_CLASS): BOOKING_ID[] {
    return booking_mapping
        .filter((mapping) => mapping.class === op_class)
        .map((mapping) => mapping.id);
}

export function get_booking_mapping(id: BOOKING_ID): Booking_mapping {
    let mapping = booking_mapping.find((mapping) => mapping.id === id);
    if (!mapping) {
        throw new Error(`No mapping found for ${id}`);
    }
    return mapping;
}   