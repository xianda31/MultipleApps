
export interface Account {
    key: string;
    description: string;
}
export interface SystemConfiguration {
    club_identifier: string;
    mode: string;
    season: string;
    debit_accounts: Account[];
    credit_accounts: Account[];
}

