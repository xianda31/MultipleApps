import { Observable } from "rxjs";
import { Schema } from "../../../../../../amplify/data/resource";


interface Fees_context {
    gameId?: string;  // optional during creation, will be set by the database
    season: string;
    fee_rate: FEE_RATE;
    member_trn_price: number;
    non_member_trn_price: number;
    fees_doubled: boolean;
    alphabetic_sort: boolean;
}
export interface Game extends Fees_context {
    tournament : { id: number; name: string; date: string; time: string } | null;

    gamers: Gamer[];
}

export enum FEE_RATE {
    STANDARD = 'standard',
    ACCESSION = 'accession',
    HOLYDAYS = 'vacances'
}

export interface Gamer {
    license: string;
    firstname: string;
    lastname: string;
    is_member: boolean;
    game_credits: number;
    acc_credits: boolean;
    index: number;
    in_euro: boolean;
    price: number;
    validated: boolean;
    enabled: boolean;
    photo_url$: Observable<string> | null;
}

export type Game_input = Omit<Schema['Game']['type'], 'id' | 'createdAt' | 'updatedAt'> ;
