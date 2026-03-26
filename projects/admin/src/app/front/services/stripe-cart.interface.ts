import { SaleItem } from '../../back/products/sale-item.interface';

export interface StripeCartItem {
  product: SaleItem;
  quantity: number;
}

export interface StripeCart {
  items: StripeCartItem[];
  subtotal: number;
}
