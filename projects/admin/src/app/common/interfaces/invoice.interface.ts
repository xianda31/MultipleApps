import { Schema } from "../../../../../../amplify/data/resource";
import { TRANSACTION_ID } from "./accounting.interface";

export interface Invoice {
  id: string;
  season: string;
  date: string;
  description: string;
  amount: number;
  account: string;
  filename: string;
  payee: string;
  transaction_id: TRANSACTION_ID;
  book_entry_id?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type Invoice_input = Omit<Schema['Invoice']['type'], 'id' | 'createdAt' | 'updatedAt'>;


export const invoicePaymentMethods: { [key in TRANSACTION_ID]?: string } = {
  [TRANSACTION_ID.dépense_en_espèces]: 'espèces',
  [TRANSACTION_ID.dépense_par_virement]: 'virement',
  [TRANSACTION_ID.dépense_par_chèque]: 'chèque Club',
  [TRANSACTION_ID.dépense_par_carte]: 'carte Club'
};