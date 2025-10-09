import { FEE_RATE } from "../../back/fees/fees.interface";

export interface Account {
    key: string;
    description: string;
}

export interface Bank {
    key: string;
    name: string;
}

export interface ImageSize {
    width: number;
    height: number;
    ratio: number;
}
export interface Fee_rate {
    key: FEE_RATE;
    member_price: number;
    non_member_price: number;
};


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

    fee_rates: Fee_rate[];

    profit_and_loss: Profit_and_loss;
    revenue_and_expense_tree: Revenue_and_expense_tree;
    banks: Bank[];
    thumbnail: ImageSize;
}

