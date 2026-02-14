import { Schema } from "../../../../../../amplify/data/resource";

export interface Invoice {
  id: string;
  season: string;
  filename: string;
  title: string;
  amount: number;
  book_entry_id?: string;
  author?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type Invoice_input = Omit<Schema['Invoice']['type'], 'id' | 'createdAt' | 'updatedAt'>;
