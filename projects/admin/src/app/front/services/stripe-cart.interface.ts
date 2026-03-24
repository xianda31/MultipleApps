import { StripeProduct } from '../../back/products/stripe-product.interface';

export interface StripeCartItem {
  product: StripeProduct;
  quantity: number;
}

export interface StripeCart {
  items: StripeCartItem[];
  subtotal: number;
}
