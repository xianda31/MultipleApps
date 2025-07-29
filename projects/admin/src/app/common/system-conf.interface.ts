
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

export interface Profit_and_loss {
    debit_key: string;       // loss = debit
    credit_key: string;   // profit = credit
}

export interface Revenue_and_expense_definition {
    key: string;
    section: string;
    description: string;
}
export interface Revenue_and_expense_tree {
    sections: { key: string, description: string }[];
    revenues: Revenue_and_expense_definition[];
    expenses: Revenue_and_expense_definition[];
}
export interface SystemConfiguration {
    club_identifier: string;
    trace_mode: boolean;
    season: string;
    club_bank_key: string;
    member_trn_price: number;
    non_member_trn_price: number;
    profit_and_loss: Profit_and_loss;
    revenue_and_expense_tree: Revenue_and_expense_tree;
    banks: Bank[];
    thumbnailSize: ImageSize;
}

