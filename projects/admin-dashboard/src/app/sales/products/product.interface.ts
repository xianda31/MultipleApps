export interface Product {
    id: string;
    glyph: string;
    description: string;
    price: number;
    category: string;
    paired: boolean;
    active: boolean;
    color?: string;
    // createdAt?: any;
    // updatedAt?: any;
}