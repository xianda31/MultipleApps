/**
 * Minimal FFB V2 native interface for tournaments
 * Extracted directly from GroupSession API response
 */
export interface TournamentV2 {
  id: number;                    // groupSessionId (also used as team_tournament_id)
  date: string;                  // ISO 8601 date (YYYY-MM-DD)
  title: string;                 // session.label
  entryCount: number;            // nbr_inscrit
  isolatedPlayerCount?: number;  // players looking for a partner
  ivPlayerMax?: number;          // maximum player IV
  moment?: string;               // phase moment
  location?: string;             // place_code
  maxTeamCount?: number;         // max teams
  expectedBoardCount?: number;   // nb_deal
}

