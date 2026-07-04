import { Observable } from "rxjs";
import { Schema } from "../../../../../../amplify/data/resource";
import { club_tournament } from "../../common/ffb/interface/club_tournament.interface";
import { TournamentV2 } from "../../common/ffb/interface/tournament-v2.interface";


interface Fees_context {
    gameId?: string;  // optional during creation, will be set by the database
    season: string;
    fee_rate: FEE_RATE;
    member_trn_price: number;
    non_member_trn_price: number;
    fees_doubled: boolean;
    alphabetic_sort: boolean;
}
export enum Game_status {
    INITIAL = 'initial',
    RECOVERED = 'récupéré',
    COMPLETED = 'terminé'
}

export interface club_tournament_extended extends TournamentV2 {
  status?: Game_status;
  chrono?: 'passed' | 'today' | 'upcoming';
};

export interface Game extends Fees_context {
    tournament : { id: number; name: string; date: string; time: string } | null;

    gamers: Gamer[];
}

export enum FEE_RATE {
    STANDARD = 'standard',
    ACCESSION = 'accession',
    HOLIDAYS = 'été'
}

export interface Gamer {
    license: string;
    firstname: string;
    lastname: string;
    is_member: boolean;
    game_credits: number;
    acc_credits: boolean;
    debt: number;
    credit: number;
    index: number;
    in_euro: boolean;
    price: number;
    validated: boolean;
    enabled: boolean;
    photo_url$: Observable<string> | null;
    member_id: string | null;
    my_birthday:string | null;
    ffb_person_id?: number; // FFB person_id (ClubMember.id) for deduplication
}

export type Game_input = Omit<Schema['Game']['type'], 'id' | 'createdAt' | 'updatedAt'> ;
