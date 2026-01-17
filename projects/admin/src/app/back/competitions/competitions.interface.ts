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

// Interface exhaustive pour la structure d'une compétition détaillée (API FFB)
export interface CompetitionData {
  id: number;
  season_id: number;
  season_label: string;
  subscription_type: string;
  name: string;
  archive_date: string | null;
  competition_id: number;
  competition_label: string;
  is_over_two_season: boolean;
  organization_id: number;
  parent_subordinate_id: number | null;
  organization_code: string;
  organization_name: string;
  has_group_paid: boolean;
  pe_bonus_process_duration: number | null;
  pe_bonus_process_enabled: boolean;
  simultaneous_code: string | null;
  division: {
    id: number;
    label: string;
  };
  festival: any; // null ou objet selon les cas
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
  phases: {
    id: number;
    name: string;
    application_deadline: string;
    min_date_publication: string;
    is_simultaneous: boolean;
    is_ko: boolean;
    is_second_chance: boolean;
    is_for_loser: boolean;
    simultaneous_calcul_mode_id: number | null;
    groups: {
      id: number;
      name: string;
      team_max_number: number;
      application_deadline: string;
      sessions: {
        id: number;
        group_id: number;
        label: string;
        date: string;
        place: string;
        mail_sent: boolean;
        is_date_deadline: boolean;
        import_result_date: string | null;
        has_realbridge: boolean;
        moment_id: number | null;
      }[];
      nb_sections: number;
      nb_rounds: number;
      nb_deals_per_round: number;
      nb_qualified: number;
      comments: string | null;
      serpentin: number;
      nb_halftime: number;
      nb_deals_per_halftime: number;
      type_id: number;
      type_code: string;
      type_label: string;
      is_probated: boolean;
      iv_min: number;
      has_teams: number;
      has_teams_who_played: number;
      serpentin_generated: boolean;
      pool_game_generated: boolean;
      parent_group_id: number | null;
      is_for_loser: boolean;
      is_second_chance: boolean;
      pe_weight: number;
      calculation_date: string;
      probation_date: string;
      has_convocation: boolean;
      convocation_sent: boolean;
      has_not_played: boolean;
      has_no_mailing: boolean;
      simultaneous_organization_id: number;
      results: {
        played: number;
        total: number;
      };
      tournament_place: {
        id: number;
        code: string;
        label: string;
      };
      has_price: boolean;
      is_qualification_group: boolean;
    }[];
  }[];
  allGroupsProbated: boolean;
  is_paid: boolean;
  billing_date: string | null;
  billing_docdate: string | null;
  calculation_date: string;
  discount: number;
  is_ic_used: number;
  has_realbridge: boolean;
  has_points: boolean;
}

