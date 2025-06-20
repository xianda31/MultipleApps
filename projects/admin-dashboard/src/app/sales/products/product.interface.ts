import { Schema } from "../../../../../../amplify/data/resource";

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

export type Product_input = Omit<Schema['Product']['type'], 'id'>;
