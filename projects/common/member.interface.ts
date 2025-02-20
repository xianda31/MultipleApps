
export interface Game_credit {
    tag: string,
    amount: number
}
export interface Member {
    id: string;
    gender: string;
    firstname: string;
    lastname: string;
    license_number: string;
    birthdate: string
    city: string
    season: string
    email: string
    phone_one: string
    // orga_license_name: string
    is_sympathisant: boolean
    license_status: string
    license_taken_at: string
    game_credits: Game_credit[]
}