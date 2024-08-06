export interface Organization {
  id: number
  code: string
  name: string
  name_article: any
  type: string
}

export interface User {
  email: string
  is_email_verified: boolean
  has_invalid_email: boolean
}
export interface Iv {
  id: number
  code: string
  label: string
  nb_pe: number
  nb_pp: number
  nb_pe_won: number
  nb_pp_won: number
}
export interface Person {
  id: number
  license_number: number
  lastname: string
  firstname: string
  gender: number
  bbo_pseudo?: string
  user: User
  iv: Iv
  organization: Organization      //2
}


export interface FFBplayer {  // was Player[]
  id: number
  position: number
  email: any
  firstname: any
  lastname: any
  gender: any
  computed_amount: number
  paid_for_team: boolean
  zoom_registrant_id: any
  zoom_join_url: any
  person: Person
  prospect: any
}

export interface FFBTeam {
  id: number
  name: string
  subscribed_at: any
  players: FFBplayer[]            // was Player[]
}

export interface ffb_teams {
  subscription_tournament: any
  teams: FFBTeam[]
}


export interface ffb_tournament {
  id: number;
  organization_id: number;
  date: string;
  moment_id: number;
  tournament_name: string
  max_teams: number
  tournament_place_type_id: number
  tournament_type_id: number
  time: string
  computed_amount: number
  tournament_status: number
  is_loaded: boolean
  type_code: string
  session_id: string
  player_count: string
  session_name: string
  session_access_key: string
  deputy_director_access_key: string
  director_access_key: string
  target_link: any
  nb_deal: number
  iv_player_max: number
  droped_target_link: string
  edulib_students_group_id: any
  vimeo_id: any
  is_halftime: boolean
  nb_round: number
  date_end: any
  description: any
  moment_code: string
  moment_label: string
  type_id: string
  type_label: string
  place_id: string
  place_code: string
  place_label: string
  tournament_place_id: number
  tournament_place_code: string
  tournament_place_label: string
  tournament_type_code: string
  tournament_type_label: string
  referee_id: number
  deputy_referee_1_id: number
  deputy_referee_2_id: any
  referee_license_number: string
  referee_firstname: string
  referee_lastname: string
  deputy_referee_1_license_number: string
  deputy_referee_1_firstname: string
  deputy_referee_1_lastname: string
  deputy_referee_2_license_number: any
  deputy_referee_2_firstname: any
  deputy_referee_2_lastname: any
  simultaneous_label: any
  simultaneous_moment: any
  simultaneous_code: any
  simultaneous_tournament_id: any
  team_tournament_id: number
  nbr_inscrit: number
  paid_amount: number
  DUPexists: boolean
};
