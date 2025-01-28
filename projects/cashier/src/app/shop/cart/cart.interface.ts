import { FINANCIAL_ACCOUNT } from "../../../../../common/accounting.interface";
import { Member } from "../../../../../common/member.interface";


// TODO : PaymentMode very similar to BOOK_ENTRY_TYPE  => streamline !
export enum PaymentMode {
    CASH = 'espèces',
    CHEQUE = 'chèque',
    TRANSFER = 'virement',
    CREDIT = 'crédit',
    ASSETS = 'avoir',
    // CARD = 'carte',
}

export const SALE_ACCOUNTS: { [key in PaymentMode]: FINANCIAL_ACCOUNT } = {
    [PaymentMode.CASH]: FINANCIAL_ACCOUNT.CASH_debit,
    [PaymentMode.CHEQUE]: FINANCIAL_ACCOUNT.CASH_debit,    // les chèques sont encaissés en caisse d'abord
    [PaymentMode.TRANSFER]: FINANCIAL_ACCOUNT.BANK_debit,
    [PaymentMode.CREDIT]: FINANCIAL_ACCOUNT.DEBT_debit,
    [PaymentMode.ASSETS]: FINANCIAL_ACCOUNT.ASSET_debit,
    // [PaymentMode.CARD]: FINANCIAL_ACCOUNT.CARD_OUT,
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




