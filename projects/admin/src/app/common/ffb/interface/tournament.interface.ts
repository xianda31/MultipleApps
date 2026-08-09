/**
 * Minimal FFB V2 native interface for tournaments.
 */
export interface Tournament {
  id: number;
  date: string;
  title: string;
  entryCount: number;
  isolatedPlayerCount?: number;
  ivPlayerMax?: number;
  moment?: string;
  location?: string;            // usually 'ftf'
  maxTeamCount?: number;
  expectedBoardCount?: number;      // nombre de donnes prévues pour la session
}

/**
 * Tournament session metadata combined with its registered teams.
 */
export interface TournamentTeams {
  tournament: Tournament;
  items: RegisteredTeam[];
  pagination?: {
    total_pages: number;
    total_items: number;
    current_page: number;
  };
}

export interface TeamSearchResponse {
  items: RegisteredTeam[];
  pagination?: {
    total_pages: number;
    total_items: number;
    current_page: number;
  };
}

export interface RegisteredTeam {
  id: number;
  iv: number;
  players: FFBPlayer[];
  tournamentRegistrationId: number;
}

export interface FFBPlayer {
  id: number;
  ffbId: number;
  migrationId?: number;
  firstName: string;
  lastName: string;
  season: Season;
}

export interface Season {
  id: number;
  ranking: Ranking;
}

export interface Ranking {
  ic: number;
  iv: number;
  pe: number;
  pec: number;
  pp: number;
  ppc: number;
}

