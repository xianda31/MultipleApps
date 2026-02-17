import { Schema } from "../../../../../../amplify/data/resource";
import { TRANSACTION_ID } from "./accounting.interface";

export interface Invoice {
  id: string;
  season: string;
  date: string;
  title: string;
  amount: number;
  account: string;
  filename: string;
  author: string;
  transaction_id: TRANSACTION_ID;
  book_entry_id?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type Invoice_input = Omit<Schema['Invoice']['type'], 'id' | 'createdAt' | 'updatedAt'>;
