
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
    dev_mode: string;
    season: string;
    member_trn_price: number;
    non_member_trn_price: number;
    charge_accounts: Account[];
    product_accounts: Account[];
    banks: Bank[];
    thumbnailSize: ImageSize;
}

