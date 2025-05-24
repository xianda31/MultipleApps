export interface Product {
    id: string;
    glyph: string;
    description: string;
    price: number;
    account: string;
    paired: boolean;
    active: boolean;
    color?: string;
    info1?: string;
    // createdAt?: any;
    // updatedAt?: any;
}