export interface GameCardAdvanceRequest {
  operationId: string;
  gameId: string;
  season: string;
  buyerId: string;
  coBuyerId?: string;
  productId: string;
  priceCents: number;
  accepted: true;
  confirmedPreviousAdvanceIds: string[];
}

export interface GameCardAdvanceResult {
  bookEntryId: string;
  playBookId: string;
  replayed: boolean;
}

export interface PreviousGameCardAdvance {
  memberId: string;
  operationId: string;
}
