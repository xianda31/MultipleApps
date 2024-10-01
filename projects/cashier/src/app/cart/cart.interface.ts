
export interface CartItem {
    product_glyph: string;
    payee_fullname: string;
    saleItem: SaleItem;
}

export interface SaleItem {
    season: string;
    product_id: string;
    payee_id: string;
    price_payed: number;
    payment_id?: string;
}



export enum PaymentMode {
    CASH = 'cash',
    CHEQUE = 'cheque',
    TRANSFER = 'transfer',
    CARD = 'card',
    DEBT = 'debt',
}

export interface Payment {
    id?: string;
    season: string;
    event: Date;
    creator: string;
    amount: number;
    payer_id: string;
    payment_mode: PaymentMode;
    bank?: string;
    cheque_no?: string;
    cross_checked?: boolean;
    saleItems?: SaleItem[];

}


export const Bank_names = ['Bank of America', 'Chase', 'Wells Fargo', 'Citigroup'];