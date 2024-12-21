import { PRODUCTS_ACCOUNTS } from "../../../../../common/new_sales.interface";

export interface Product {
    id: string;
    glyph: string;
    description: string;
    price: number;
    account: PRODUCTS_ACCOUNTS;
    paired: boolean;
    active: boolean;
    color?: string;
    // createdAt?: any;
    // updatedAt?: any;
}