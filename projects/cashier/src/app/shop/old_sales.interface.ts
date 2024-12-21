

export interface Record {
    id?: string;
    class: string;

    season: string;
    amount: number;
    sale_id: string;

    member_id?: string;  // payer or payee
    mode?: PaymentMode;
    // bank?: string;
    cheque?: string;
    deposit_ref?: string;
    bank_statement?: string;
    product_id?: string;

}
export interface Session {
    season: string;
    vendor: string;
    date: string;
}
export interface Sale extends Session {
    id?: string;
    createdAt?: string;
    payer_id: string;
    comment?: string;
    records?: Record[];
}

export enum PaymentMode {
    CASH = 'espèces',
    CHEQUE = 'chèque',
    TRANSFER = 'virement',
    CREDIT = 'crédit',
    ASSETS = 'avoir',
    // CARD = 'carte',
}


export interface f_products { [payee: string]: { [product_key: string]: number } }
export interface f_payments { [payment_key: string]: number }
export interface f_Sale {
    sale_id: string;
    date: string;
    payees_nbr: number;
    payments: f_payments;
    products: f_products;
    reference?: string;
}