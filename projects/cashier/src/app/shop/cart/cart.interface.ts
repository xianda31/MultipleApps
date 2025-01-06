import { Member } from "../../../../../common/member.interface";

export enum PaymentMode {
    CASH = 'espèces',
    CHEQUE = 'chèque',
    TRANSFER = 'virement',
    CREDIT = 'crédit',
    ASSETS = 'avoir',
    // CARD = 'carte',
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




