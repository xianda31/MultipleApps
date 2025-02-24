
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


export interface Sub_class {
    key: string;
    class: string;
    description: string;
}
export interface Financial_tree {
    classes: { key: string, description: string }[];
    revenues: Sub_class[];
    expenses: Sub_class[];
}
export interface SystemConfiguration {
    club_identifier: string;
    dev_mode: string;
    season: string;
    club_bank_key: string;
    member_trn_price: number;
    non_member_trn_price: number;
    financial_tree: Financial_tree;
    banks: Bank[];
    thumbnailSize: ImageSize;
}

