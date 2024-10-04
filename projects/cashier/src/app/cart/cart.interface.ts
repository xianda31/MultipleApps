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
    creator: string;
    event: Date;
    payments: Payment[];
}

export interface Payment {
    id?: string;
    amount: number;
    payer_id: string;
    session_id: string;
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


// export const Bank_names = ['Bank of America', 'Chase', 'Wells Fargo', 'Citigroup'];
export const Bank_names = {
    'COU': 'Banque Courtois',
    'POP': 'Banque Populaire',
    'POS': 'Banque Postale',
    'BNP': 'BNP',
    'RAM': 'Boursorama',
    'EPA': 'Caisse d\'Epargne',
    'AGR': 'Crédit Agricole',
    'LYO': 'Crédit Lyonnais',
    'MUT': 'Crédit Mutuel',
    'FOR': 'Fortuneo',
    'Hi!': 'HSBC',
    'ING': 'ING',
    "AXA": 'AXA',
    'LCL': 'LCL',
    'SOG': 'Société Générale',
    'CCF': 'CCF',
    'COO': 'Crédit Coopératif',
}
