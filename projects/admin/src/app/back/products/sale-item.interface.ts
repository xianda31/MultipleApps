import { Schema } from "../../../../../../amplify/data/resource";

export interface SaleItem {
  id: string;
  name: string;
  description: string;
  glyph: string;
  price: number;              // en euros
  account: string;
  entries?: number | null;    // nb entrées carte
  paired: boolean;
  currency: string;
  stripeEnabled: boolean;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type SaleItemInput = Omit<Schema['SaleItem']['type'], 'id' | 'createdAt' | 'updatedAt'>;
