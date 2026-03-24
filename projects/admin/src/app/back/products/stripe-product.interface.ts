import { Schema } from "../../../../../../amplify/data/resource";

export interface StripeProduct {
  id: string;
  name: string;
  description?: string | null;
  amount: number;
  currency: string;
  active: boolean;
}

export type StripeProductInput = Omit<Schema['StripeProduct']['type'], 'createdAt' | 'updatedAt'>;
