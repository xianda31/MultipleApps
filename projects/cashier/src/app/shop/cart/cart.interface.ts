import { Member } from "../../../../../common/member.interface";
import { PaymentMode } from "../sales.interface";


export interface Payment {
    amount: number;
    payer_id: string;
    mode: PaymentMode;
    bank?: string;
    cheque_no?: string;
}


export interface CartItem {
    payee?: Member | null;    // null => 2nd payee to fill-in
    paied: number;
    payee_id: string;
    product_id: string;
}




