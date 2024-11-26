import { Member } from "../../../../../common/member.interface";

interface Fees_context {
    season: string;
    member_trn_price: number;
    non_member_trn_price: number;
    fees_doubled: boolean;
    alphabetic_sort: boolean;
}
export interface Game extends Fees_context {
    gamers: Gamer[];
}

export interface Gamer {
    license: string;
    firstname: string;
    lastname: string;
    is_member: Member | undefined;
    games_credit: number;
    index: number;
    in_euro: boolean;
    price: number;
    validated: boolean;
}