
export interface FFBplayer {
    organization_id: number
    organization_code: string
    organization_type: string
    last_club: string
    last_season: string
    is_current_season: boolean
    season_startdate: string
    committee_id: number
    committee_name: string
    committee_code: string
    iv: number
    ic: Ic
    person_id: number
    lastname: string
    firstname: string
    gender: number
    license_number: string
    city: string
    address: Address
    user_id: number
    bbo_pseudo?: string
    funbridge_pseudo?: string
    is_email_verified: boolean
    has_invalid_email: boolean
    first_licence_date: string
    birthdate: string
}

export interface Ic {
    ic?: number
    code: string
    label: string
}

export interface Address {
    address: string
    zipcode: string
    city: string
    country: string
    further_address_details_1: string
    further_address_details_2: string
}
