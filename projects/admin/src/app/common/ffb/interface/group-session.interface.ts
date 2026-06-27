/**
 * FFB API V2 GroupSession - Response from /competitions/groupSessions/search
 * Represents a tournament session (group session) as returned by FFB V2 API
 */
export interface GroupSession {
  id: number;
  date: string; // ISO8601
  description: string;
  entryCount: number;
  entryScope: string;
  expectedBoardCount: number;
  location: string;
  maxTeamCount: number | null;
  allowPlayerEntries: boolean;
  group: Group;
  session: Session;
}

export interface Group {
  id: number;
  label: string;
  clubTournament: boolean;
  phase: Phase;
}

export interface Phase {
  id: number;
  label: string;
  stade: Stade;
  organization: Organization;
}

export interface Stade {
  id: number;
  label: string;
}

export interface Session {
  id: number;
  label: string;
  format: 'pair' | 'team' | string;
  rankingScoringType: string;
  organizations: Array<{ id: number; groupId: number }>;
}

export interface Organization {
  id: number;
  label: string;
  ffbCode: string;
  type: string;
}

export interface GroupSessionSearchResponse {
  items: GroupSession[];
  pagination?: {
    total_items: number;
    total_pages: number;
    current_page: number;
    per_page: number;
  };
}
