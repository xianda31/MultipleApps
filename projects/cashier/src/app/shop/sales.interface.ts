
export interface SaleItem {
    season: string;
    payee_id: string;
    payed: number;
    product_id: string;
    sale_id?: string;
}

export interface Session {
    season: string;
    vendor: string;
    event: string;
}

export interface Revenue {
    season: string;
    amount: number;
    sale_id?: string;
    mode: PaymentMode;
    bank?: string;
    cheque_no?: string;
}
export interface Sale extends Session {
    payer_id: string;
    id?: string;
    createdAt?: string;
    amount: number;
    revenues: Revenue[];
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