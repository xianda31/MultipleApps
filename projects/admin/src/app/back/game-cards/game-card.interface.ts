import { Schema } from "../../../../../../amplify/data/resource";
import { Member } from "../../common/member.interface";

export interface GameCard extends PlayBook {
  owners: Member[];
}

export interface PlayBook {
  id : string;
  initial_qty: number;
  stamps: string[];
  licenses: string[];
  createdAt?: string;
  updatedAt?: string;
}
  
  
  export const MAX_STAMPS = 12;

export type PlayBook_input = Omit<Schema['PlayBook']['type'], 'id' | 'createdAt' | 'updatedAt'> ;
