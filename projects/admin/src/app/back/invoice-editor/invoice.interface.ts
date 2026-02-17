import { TRANSACTION_ID } from "../../common/interfaces/accounting.interface";

export const invoicePaymentMethods: { [key in TRANSACTION_ID]?: string } = {
  [TRANSACTION_ID.dépense_en_espèces]: 'paiement espèces',
  [TRANSACTION_ID.dépense_par_virement]: 'paiement par virement',
  [TRANSACTION_ID.dépense_par_chèque]: 'paiement par chèque Club',
  [TRANSACTION_ID.dépense_par_carte]: 'paiement par carte Club'
};

  