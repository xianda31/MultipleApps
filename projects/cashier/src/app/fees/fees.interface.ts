import { club_tournament } from "../../../../common/ffb/interface/club_tournament.interface";
import { Game_credit, Member } from "../../../../common/member.interface";

export const MAX_CREDITS_HISTORY = 10;

interface Fees_context {
    season: string;
    member_trn_price: number;
    non_member_trn_price: number;
    fees_doubled: boolean;
    alphabetic_sort: boolean;
}
export interface Game extends Fees_context {
    tournament: club_tournament | null;
    gamers: Gamer[];
}

export interface Gamer {
    license: string;
    firstname: string;
    lastname: string;
    is_member: Member | undefined;
    game_credits: number;
    index: number;
    in_euro: boolean;
    price: number;
    validated: boolean;
}