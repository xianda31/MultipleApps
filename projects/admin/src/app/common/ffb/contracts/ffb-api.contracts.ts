export interface ApiTournamentDto {
  id: number;
  organization_id: number;
  date: string;
  moment_id: number;
  tournament_name: string;
  max_teams: number;
  tournament_place_type_id: number;
  tournament_type_id: number;
  time: string;
  computed_amount: number;
  tournament_status: number;
  is_loaded: boolean;
  type_code: string;
  session_id: unknown;
  player_count: unknown;
  session_name: string;
  session_access_key: string;
  deputy_director_access_key: string;
  director_access_key: string;
  target_link: unknown;
  nb_deal: number;
  iv_player_max: number;
  droped_target_link: unknown;
  edulib_students_group_id: unknown;
  vimeo_id: unknown;
  is_halftime: boolean;
  nb_round: number;
  date_end: unknown;
  description: unknown;
  mail_sent: unknown;
  moment_code: string;
  moment_label: string;
  type_id: string;
  type_label: string;
  place_id: string;
  place_code: string;
  place_label: string;
  tournament_place_id: number;
  tournament_place_code: string;
  tournament_place_label: string;
  tournament_type_code: string;
  tournament_type_label: string;
  referee_id: number;
  deputy_referee_1_id: unknown;
  deputy_referee_2_id: unknown;
  referee_license_number: string;
  referee_firstname: string;
  referee_lastname: string;
  deputy_referee_1_license_number: unknown;
  deputy_referee_1_firstname: unknown;
  deputy_referee_1_lastname: unknown;
  deputy_referee_2_license_number: unknown;
  deputy_referee_2_firstname: unknown;
  deputy_referee_2_lastname: unknown;
  simultaneous_label: unknown;
  simultaneous_moment: unknown;
  simultaneous_code: unknown;
  simultaneous_tournament_id: unknown;
  team_tournament_id: string;
  nbr_inscrit: number;
  has_isolated_player: boolean;
  paid_amount: number;
  DUPexists: boolean;
}

export interface ApiCompetitionSeasonDto {
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

export interface ApiCompetitionOrganizationDto {
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

export type ApiCompetitionDto = Record<string, unknown>;
export type ApiCompetitionPhasesDto = Record<string, unknown>;
export type ApiCompetitionTeamDto = Record<string, unknown>;

export type ApiFfbPersonDto = Record<string, unknown>;
export type ApiFfbPlayerDto = Record<string, unknown>;
export type ApiFfbLicenseeDto = Record<string, unknown>;
export type ApiPersonDto = Record<string, unknown>;
export type ApiTournamentTeamsDto = Record<string, unknown>;
