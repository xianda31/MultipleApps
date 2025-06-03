import { Member } from "../../../../common/member.interface";

export interface GameCard {
  id: string;
  owners: Member[];
  stamps: string[];
  initial_qty: number;
  createdAt?: string;
  updatedAt?: string;

}

export const MAX_STAMPS = 12;