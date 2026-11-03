import { Observable } from "rxjs";
import { Schema } from "../../../../../../amplify/data/resource";
import { club_tournament } from "../../common/ffb/interface/club_tournament.interface";
import { Tournament } from "../../common/ffb/interface/tournament.interface";


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

export interface club_tournament_extended extends Tournament {
  status?: Game_status;
  chrono?: 'passed' | 'today' | 'upcoming';
};

export interface Game extends Fees_context {
    tournament : { id: number; name: string; date: string; time: string } | null;

    gamers: Gamer[];
}

export enum FEE_RATE {
    STANDARD = 'standard',
    HOLIDAYS = 'été'
}

export interface Gamer {
    license: string;
    firstname: string;
    lastname: string;
    is_member: boolean;
    game_credits: number;
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
    check_in_source?: GameCheckInSource;
    check_in_updated_by?: string;
    check_in_updated_at?: string;
}

export type GameCheckInMode = 'card' | 'euro' | 'none';
export type GameCheckInSource = 'manual' | 'nfc';

export interface GameCheckIn {
    gameId: string;
    license: string;
    mode: GameCheckInMode;
    source: GameCheckInSource;
    updatedBy: string;
    updatedAt?: string;
}

export interface GameFeeConfiguration {
    gameId: string;
    feeRate: FEE_RATE;
    memberPrice: number;
    nonMemberPrice: number;
    feesDoubled: boolean;
    updatedBy: string;
    updatedAt?: string;
}

export type GameSettlementPhase = 'locked' | 'cards' | 'accounting' | 'document' | 'completing' | 'completed';

export interface GameSettlement {
    gameId: string;
    status: 'closing' | 'completed' | 'failed';
    lockedBy: string;
    error?: string | null;
    phase?: GameSettlementPhase | null;
    resumeToken?: string | null;
    tabId?: string | null;
    clientBuild?: string | null;
    startedAt?: string | null;
    heartbeatAt?: string | null;
    totalCardPayers?: number | null;
    processedCardPayers?: number | null;
    processedLicenses?: (string | null)[] | null;
    activeLicense?: string | null;
    activeStampCountBefore?: number | null;
    activeStampsRequired?: number | null;
    errorPhase?: string | null;
    errorAt?: string | null;
    errorDetails?: string | null;
    createdAt?: string;
    updatedAt?: string;
}

export interface GameSettlementContext {
    lockedBy: string;
    resumeToken: string;
    tabId: string;
    clientBuild: string;
    totalCardPayers: number;
    staleAfterMs: number;
}

export interface GameSettlementAcquisition {
    outcome: 'acquired' | 'resumed' | 'closing' | 'completed' | 'failed';
    settlement: GameSettlement;
}

export type Game_input = Omit<Schema['Game']['type'], 'id' | 'createdAt' | 'updatedAt'> ;
