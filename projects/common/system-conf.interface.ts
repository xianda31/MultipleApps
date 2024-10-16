
export interface Account {
    key: string;
    description: string;
}

export interface Bank {
    key: string;
    name: string;
}

export interface ImageSize {
    max_width: number;
    max_height: number;
    ratio: number;
}

export interface SystemConfiguration {
    club_identifier: string;
    mode: string;
    season: string;
    debit_accounts: Account[];
    credit_accounts: Account[];
    banks: Bank[];
    thumbnailSize: ImageSize;
}

