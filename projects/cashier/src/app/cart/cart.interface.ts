import { Member } from "../../../../common/member.interface";

export interface CartItem extends SaleItem {
    payee: Member | null;
}

export interface SaleItem {
    product_id: string;
    payee_id: string;
    price_payed: number;
    sale_id?: string;
}

export interface Session {
    season: string;
    vendor: string;
    event: string;
}

export interface Payment {
    type: PaymentMode;
    bank?: string;
    cheque_no?: string;
    cross_checked?: boolean;
}
export interface Sale extends Session {
    id?: string;
    createdAt?: string;
    payer_id: string;
    amount: number;
    payments: Payment[];
    saleItems: SaleItem[];
}

export enum PaymentMode {
    CASH = 'espèces',
    CHEQUE = 'chèque',
    TRANSFER = 'virement',
    DEBT = 'dette',
    ASSETS = 'avoir',
    CARD = 'carte',
}

