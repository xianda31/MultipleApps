import { Member } from "../../../../common/member.interface";

export interface CartItem {
    // product_glyph: string;
    payee: Member | null;   // pour mettre une raz dans le champ de saisie
    saleItem: SaleItem;
}

export interface SaleItem {
    // season: string;
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
    payment_mode: PaymentMode;
    bank?: string;
    cheque_no?: string;
    cross_checked?: boolean;
}
export interface Sale {
    id?: string;
    payer_id: string;
    amount: number;
    session: Session;
    payment: Payment;
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

