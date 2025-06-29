
export interface Balance_record {
    season: string;
    cash: number;
    bank: number;
    savings: number;
    uncashed_cheques: number; // chèques non encaissés à déposer
    outstanding_expenses: number; // dettes,charges à payer
    gift_vouchers: number; // chèques cadeaux
    client_debts: number; // dettes clients
    // client_assets: number; // créances clients
  }
export interface Balance_sheet  extends Balance_record {
    in_bank_total: number; // total banque (livret + compte courant)
    cashbox: number; // liquidités (caisse + dettes ou petits avoirs clients + chèques non encaissés)
    wip_total: number; // total en cours (fond de caisse + dettes_créances  + chèques cadeaux + paiements en cours)
    actif_total: number; // total actif (total banque + total caisse + créances + chèques non encaissés + chèques cadeaux + paiements en cours)
  }


export interface Balance_board  {
    current : Balance_sheet;
    previous: Balance_sheet;
    delta: Balance_sheet;
}
