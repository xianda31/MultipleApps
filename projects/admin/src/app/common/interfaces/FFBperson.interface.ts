export interface FFBPersonPicture {
  id: number;
  thumbnail: string;
  big: string;
}

export interface FFBPersonIV {
  iv: number;
  label: string;
  code: string;
}

export interface FFBPersonIC {
  ic: number;
  label: string;
  code: string;
}

export interface FFBPersonLicence {
  id: number;
  type: string;
  subtype: string;
  season_id: number;
  season: string;
  is_current: boolean;
  state: string;
  status: string;
  organization_id: number;
  organization_code: string;
  organization_name: string;
  organization_type: string;
  subordinate_id: number;
  first_licence_date: string;
  register: boolean;
  free: boolean;
  committee_id: number;
  committee_code: string;
  committee_name: string;
  committee_school_id: number | null;
  committee_school_label: string | null;
  committee_school_city: string | null;
  school_year: string | null;
}

export interface FFBPersonAddress {
  id: number;
  address: string;
  zipcode: string;
  city: string;
  country: string;
  further_address_details_1: string;
  further_address_details_2: string;
}

export interface FFBPersonIndustry {
  id: number;
  name: string;
}

export interface FFBPersonCategorySocial {
  id: number;
  name: string;
}

export interface FFBPersonSeason {
  id: number;
  name: string;
  last: boolean;
  start_date: string;
  end_date: string;
  block_date: string;
  per_aff_ref: number;
  organization_id: number;
  organization_name: string;
}

export interface FFBPersonRegularityTournamentPoint {
  tournament_id: number;
  club: string;
  pe: string | null;
  pe_bonus: string | null;
  moment: string;
  date: string;
  name: string;
}

export interface FFBPerson {
  id: number;
  is_enabled: boolean;
  has_lancelot_account: boolean;
  lastname: string;
  firstname: string;
  license_number: string;
  letter: string;
  gender: number;
  is_alive: boolean;
  deceased_season_id: number | null;
  first_licence_date: string;
  picture: FFBPersonPicture;
  iv: FFBPersonIV;
  licence: FFBPersonLicence;
  is_current_season: boolean;
  season_startdate: string;
  agreements: any;
  address: FFBPersonAddress;
  secondary_iv: any;
  secondary_ic: any;
  nb_pp_minimum: any;
  enddate_ppmin: any;
  max_iv: number;
  max_iv_label: string;
  is_first_season: boolean;
  is_suspended: boolean;
  is_email_verified: boolean;
  ic: FFBPersonIC;
  organization_code: string;
  birthdate: string;
  bbo_pseudo: string | null;
  funbridge_pseudo: string | null;
  nationality: string;
  is_private_account: boolean;
  is_ns_fixed: boolean;
  created_at: string;
  updated_at: string;
  industry: FFBPersonIndustry;
  category_social: FFBPersonCategorySocial;
  is_locked: boolean;
  is_bypass_2fa: boolean;
  token_securizer: any;
  seasons: FFBPersonSeason[];
  email: string;
  real_email: string | null;
  is_email_confirmation_sent: boolean;
  phone_one: string;
  phone_two: string | null;
  regularity_tournament_points: FFBPersonRegularityTournamentPoint[];
}
