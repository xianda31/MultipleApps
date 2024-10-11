import { Member } from "../../../../common/members/member.interface";

export interface CartItem {
    product_glyph: string;
    payee: Member | null;   // pour mettre une raz dans le champ de saisie
    saleItem: SaleItem;
}

export interface SaleItem {
    // season: string;
    product_id: string;
    payee_id: string;
    price_payed: number;
    payment_id?: string;
}

export interface Session {
    season: string;
    vendor: string;
    event: string;
}

export interface Payment {
    id?: string;
    amount: number;
    payer_id: string;
    season: string;
    vendor: string;
    event: string;
    payment_mode: PaymentMode;
    bank?: string;
    cheque_no?: string;
    cross_checked?: boolean;
    saleItems?: SaleItem[];

}

export enum PaymentMode {
    CASH = 'espèces',
    CHEQUE = 'chèque',
    TRANSFER = 'virement',
    CARD = 'carte',
    DEBT = 'dette',
}

