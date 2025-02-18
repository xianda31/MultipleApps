import { CUSTOMER_ACCOUNT, FINANCIAL_ACCOUNT } from "../../../../../common/accounting.interface";
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

export const SALE_ACCOUNTS: { [key in PaymentMode]: FINANCIAL_ACCOUNT | CUSTOMER_ACCOUNT } = {
    [PaymentMode.CASH]: FINANCIAL_ACCOUNT.CASHBOX_debit,
    [PaymentMode.CHEQUE]: FINANCIAL_ACCOUNT.BANK_debit,    // les chèques sont encaissés en banque direct // caisse d'abord
    [PaymentMode.TRANSFER]: FINANCIAL_ACCOUNT.BANK_debit,
    [PaymentMode.CREDIT]: CUSTOMER_ACCOUNT.DEBT_debit,
    [PaymentMode.ASSETS]: CUSTOMER_ACCOUNT.ASSET_debit,
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
    // payee_id: string;
    product_id: string;
    product_account: string;
    payee_name: string;
}

export interface Cart {
    items: CartItem[];
    debt: { name: string, amount: number } | null;
    asset: { name: string, amount: number } | null;
    buyer_name: string;
}




