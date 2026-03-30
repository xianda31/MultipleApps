import { Schema } from "../../../../../../amplify/data/resource";

export interface SaleItem {
  id: string;
  name: string;
  description: string;
  glyph: string;
  price: number;              // en euros (prix total de l'achat)
  account: string;
  paired: boolean;            // produit couplé (paire de membres)
  currency: string;
  stripeEnabled: boolean;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type SaleItemInput = Omit<Schema['SaleItem']['type'], 'id' | 'createdAt' | 'updatedAt'>;
