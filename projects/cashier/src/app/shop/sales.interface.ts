
// export interface SaleItem {
//     id?: string;
//     season: string;
//     payee_id: string;
//     paied: number;
//     product_id: string;
//     sale_id?: string;
// }


// export enum DebitCredit {
//     DEBIT = 'DEBIT',
//     CREDIT = 'CREDIT',
// }
export interface Record {
    id?: string;
    class: string;

    season: string;
    amount: number;
    // debit_credit: DebitCredit;
    sale_id: string;

    member_id?: string;  // payer or payee
    // payment reference => class 5 or 6
    // payer_id?: string;
    mode?: PaymentMode;
    bank?: string;
    cheque_no?: string;

    // product reference => class 7
    // payee_id?: string;
    product_id?: string;

}
export interface Session {
    season: string;
    vendor: string;
    event: string;
}



export interface Sale extends Session {
    // payer_id: string;
    id?: string;
    createdAt?: string;
    // amount: number;
    payer_id: string;
    records?: Record[];

    // revenues: Revenue[];
    // saleItems: SaleItem[];
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
    event: string;
    payees_nbr: number;
    payments: f_payments;
    products: f_products;
}