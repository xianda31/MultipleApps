
export interface Tournament extends club_tournament { }

export interface club_tournament {
    id: number
    organization_id: number
    date: string
    moment_id: number
    tournament_name: string
    max_teams: number
    tournament_place_type_id: number
    tournament_type_id: number
    time: string
    computed_amount: number
    tournament_status: number
    is_loaded: boolean
    type_code: string
    session_id: any
    player_count: any
    session_name: string
    session_access_key: string
    deputy_director_access_key: string
    director_access_key: string
    target_link: any
    nb_deal: number
    iv_player_max: number
    droped_target_link: any
    edulib_students_group_id: any
    vimeo_id: any
    is_halftime: boolean
    nb_round: number
    date_end: any
    description: any
    mail_sent: any
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
    deputy_referee_1_id: any
    deputy_referee_2_id: any
    referee_license_number: string
    referee_firstname: string
    referee_lastname: string
    deputy_referee_1_license_number: any
    deputy_referee_1_firstname: any
    deputy_referee_1_lastname: any
    deputy_referee_2_license_number: any
    deputy_referee_2_firstname: any
    deputy_referee_2_lastname: any
    simultaneous_label: any
    simultaneous_moment: any
    simultaneous_code: any
    simultaneous_tournament_id: any
    team_tournament_id: string //number
    nbr_inscrit: number
    has_isolated_player: boolean
    paid_amount: number
    DUPexists: boolean
}
