export interface Product {
    id: string;
    glyph: string;
    description: string;
    price: number;
    category: string;
    double_ownership: boolean;
    active: boolean;
    color?: string;
    // createdAt?: any;
    // updatedAt?: any;
}