export interface TeamSearchResponse {
  items: TeamItem[];
  pagination?: {
    total_pages: number;
    total_items: number;
    current_page: number;
  };
}

export interface TeamItem {
  id: number;
  label: string | null;
  comment: string | null;
  ic: number;
  iv: number;
  pe: number;
  pec: number;
  pp: number;
  ppc: number;
  captain: FFBPlayer;
  players: FFBPlayer[];
  competitionDivision: CompetitionDivision;
  organization: any | null;
  teamEntries: TeamEntry[];
  currentTeamEntry: TeamEntryDetail;
}

export interface FFBPlayer {
  id: number;
  migrationId: number;
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

export interface CompetitionDivision {
  id: number;
  label: string;
  sponsor: any | null;
}

export interface TeamEntry {
  id: number;
  group: Group;
  groupSession: { id: number };
  odooTransaction: any | null;
  orientation: any | null;
  phase: Phase;
  section: any | null;
  stade: Stade;
  startTableNumber: number | null;
  team: { id: number };
}

export interface TeamEntryDetail extends Omit<TeamEntry, 'team'> {
  team: TeamItemSnippet;
}

// Version simplifiée de la team incluse dans currentTeamEntry pour éviter la récursion infinie
export interface TeamItemSnippet
  extends Omit<TeamItem, 'currentTeamEntry' | 'teamEntries'> {
  teamEntries: Array<{ id: number }>;
}

export interface Group {
  id: number;
  label: string;
  migrationId: number;
  unique: boolean;
}

export interface Phase {
  id: number;
  label: string;
  migrationId: number;
  groupCount: number;
  unique: boolean;
}

export interface Stade {
  id: number;
  migrationId: number;
  phaseCount: number;
}
