
export interface CartItem {
    payee_id: string;
    payee_fullname: string;
    article: Article;
}

interface Article {
    product_id: string;
    product_glyph: string;
    price: number;
}
export interface BookEntry {
    // payee_id: string;
    // fullname: string;
    articles: Article[];
    payment_id: string;
}

export interface Payment {
    id: string;
    date: string;
    amount: number;
    // payer_name: string;
    bank: string;
    cheque_number: string;

}