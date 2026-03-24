import { Schema } from "../../../../../../amplify/data/resource";

export interface StripeProduct {
  stripeId: string;
  name: string;
  description?: string;
  amount: number;
  currency: string;
  active: boolean;
}

export type StripeProductInput = Omit<Schema['StripeProduct']['type'], 'createdAt' | 'updatedAt'>;
