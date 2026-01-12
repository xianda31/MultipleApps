export interface CompetitionResults {
  competition: Competition;
  teams: CompetitionTeam[];
}

export interface CompetitionResultsMap {
  [competitionId: number]: CompetitionResults;
}
export interface Player {
  id: number;
  gender: string;
  license_number: string;
  firstname: string;
  lastname: string;
  nb_deals_played: number;
  pp: number;
  pp_bonus: number;
  pe: number;
  pe_bonus: number;
  pp_extra: number;
  pe_extra: number;
  is_ic_used: boolean;
  // addeditional field for service use
  is_member?: boolean;
}

export interface CompetitionTeam {
  team_id: number;
  team_iv: number;
  team_name: string;
  rank: number;
  theorical_rank: number;
  is_ic_used: boolean;
  players: Player[];
}

export interface CompetitionOrganization {
  id: number;
  label: string;
  type: string;
  subordinate_id: number;
  organization_code: string;
  has_realbridge_tournament: boolean;
  has_funbridge_tournament: boolean;
  is_club_digital: boolean;
  can_renew_member: boolean;
  can_renew_external_member: boolean;
  email_renew_member: string | null;
}

export interface CompetitionSeason {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  block_date: string | null;
  is_current: boolean;
  block_license_creation_date: string | null;
  is_easi: boolean;
  is_license_creation_forbidden: boolean;
  can_bypass_blocking: boolean;
}
export interface Competition {
  id: number;
  label: string;
  season_id: number;
  previous_season_id: number | null;
  pe_bonus_process_duration: number | null;
  pe_bonus_process_enabled: boolean;
  simultaneous_code: string | null;
  organization_id: number;
  division: {
    id: number;
    label: string;
  };
  family: {
    id: number;
    label: string;
    is_ko: boolean;
  };
  type: {
    id: number;
    label: string;
    code: string;
  };
  format: {
    id: number;
    label: string;
    code: string;
  };
  festival: any | null;
  archive_date: string | null;
  allGroupsProbated: boolean;
  subscription_type: string | null;
  is_paid: boolean;
  billing_date: string | null;
  billing_docdate: string | null;
  nb_phases: number;
  nb_simultaneous_phases: number;
}

