import { FINANCIAL_ACCOUNTS } from "../../../../../common/accounting.interface";
import { Member } from "../../../../../common/member.interface";

export enum PaymentMode {
    CASH = 'espèces',
    CHEQUE = 'chèque',
    TRANSFER = 'virement',
    CREDIT = 'crédit',
    ASSETS = 'avoir',
    // CARD = 'carte',
}

export const SALE_ACCOUNTS: { [key in PaymentMode]: FINANCIAL_ACCOUNTS } = {
    [PaymentMode.CASH]: FINANCIAL_ACCOUNTS.CASH_debit,
    [PaymentMode.CHEQUE]: FINANCIAL_ACCOUNTS.CASH_debit,    // les chèques sont encaissés en caisse d'abord
    [PaymentMode.TRANSFER]: FINANCIAL_ACCOUNTS.BANK_debit,
    [PaymentMode.CREDIT]: FINANCIAL_ACCOUNTS.DEBT_debit,
    [PaymentMode.ASSETS]: FINANCIAL_ACCOUNTS.ASSET_debit,
    // [PaymentMode.CARD]: FINANCIAL_ACCOUNTS.CARD_OUT,
}


export interface Payment {
    amount: number;
    payer_id: string;
    mode: PaymentMode;
    bank: string;
    cheque_no: string;
}


export interface CartItem {
    payee?: Member | null;    // null => 2nd payee to fill-in
    paied: number;
    payee_id: string;
    product_id: string;
    product_account: string;
    payee_name: string;
}




