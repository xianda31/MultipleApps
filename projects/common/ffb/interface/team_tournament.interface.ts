export interface team_tournament {
    subscription_tournament: SubscriptionTournament
    teams: Team[]
    isolated_player_count: number
}

export interface SubscriptionTournament {
    id: number
    attachment_dup: any
    attachment_data: any
    organization_club_tournament: OrganizationClubTournament
    competition: any
    competition_festival: any
    simultanee: any
    tournament: any
    organization: Organization
    referee: Referee
    deputy_referee1: any
}

export interface OrganizationClubTournament {
    id: number
    date: string
    tournament_name: string
    max_teams: number
    time: string
    computed_amount: number
    tournament_status: number
    is_loaded: boolean
    type_code: string
    target_link: any
    droped_target_link: any
    session_id: any
    session_name: string
    session_access_key: string
    deputy_director_access_key: string
    director_access_key: string
    player_count: any
    nb_deal: number
    iv_player_max: number
    is_halftime: boolean
    vimeo_id: any
    nb_round: any
    date_end: any
    description: any
    moment: Moment
    tournament_type: TournamentType
    tournament_place_type: TournamentPlaceType
}

export interface Moment {
    id: number
    code: string
    label: string
}

export interface TournamentType {
    id: number
    code: string
    label: string
    position: number
}

export interface TournamentPlaceType {
    id: number
    tournament_place: TournamentPlace
    tournament_type: TournamentType2
}

export interface TournamentPlace {
    id: number
    code: string
    label: string
}

export interface TournamentType2 {
    id: number
    code: string
    label: string
    position: number
}

export interface Organization {
    id: number
    code: string
    name: string
    name_article: any
    type: string
}

export interface Referee {
    id: number
    license_number: number
    lastname: string
    firstname: string
    gender: number
}

export interface Team {
    id: number
    name: string
    subscribed_at: SubscribedAt
    players: Player[]
    is_isolated_player: boolean
}

export interface SubscribedAt {
    date: string
    timezone_type: number
    timezone: string
}

export interface Player {
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

export interface Person {
    id: number
    license_number: number
    lastname: string
    firstname: string
    gender: number
    bbo_pseudo?: string
    user: User
    organization: Organization2
    iv: Iv
}

export interface User {
    email?: string
    is_email_verified: boolean
    has_invalid_email: boolean
}

export interface Organization2 {
    id: number
    code: string
    name: string
    name_article: any
    type: string
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
