import { Injectable } from '@angular/core';
import { ToastService } from '../../common/services/toast.service';
import { BookEntry, FINANCIAL_ACCOUNT, TRANSACTION_ID } from '../../common/interfaces/accounting.interface';
import { TRANSACTION_CLASS, TRANSACTION_DIRECTORY, Transaction } from '../../common/interfaces/transaction.definition';

@Injectable({
  providedIn: 'root'
})
export class TransactionService {

  constructor(
    private toastService: ToastService,
  ) { }


class_to_ids(_class: TRANSACTION_CLASS): TRANSACTION_ID[] {
  let check = Object.values(TRANSACTION_CLASS).includes(_class);
  if (check) {
    return Object.entries(TRANSACTION_DIRECTORY)
      .filter(([key, transaction]) => transaction.class === _class)
      .map(([key, transaction]) => key as TRANSACTION_ID);
  } else {
    console.log('%s n\'est pas une clef de %s', _class, JSON.stringify(Object.entries(TRANSACTION_CLASS)));
    throw new Error(`class ${_class} not found`);
  }
}

transaction_class(id: TRANSACTION_ID): TRANSACTION_CLASS {
  let check = Object.keys(TRANSACTION_DIRECTORY).includes(id);
  if (check) {
    return TRANSACTION_DIRECTORY[id].class;
  } else {
    this.toastService.showError('écriture comptable corrompue', `transaction " ${id} " inconnue`);
    throw new Error(`transaction ${id} not found`);
  }
}

list_transaction_classes(): TRANSACTION_CLASS[] {
  let classes = new Map<string, TRANSACTION_CLASS>();
  Object.entries(TRANSACTION_DIRECTORY).forEach(([key, transaction]) => {
    if (!classes.has(transaction.class)) {
      classes.set(transaction.class, transaction.class);
    }
  });
  return Array.from(classes.values());

}

get_transaction(id: TRANSACTION_ID): Transaction {
  let check = Object.keys(TRANSACTION_DIRECTORY).includes(id);
  if (check) {
    return TRANSACTION_DIRECTORY[id];
  } else {
    this.toastService.showError('écriture comptable corrompue', `transaction " ${id} " inconnue`);
    throw new Error(`transaction ${id} not found`);
  }
}

get_entry_label(entry: BookEntry): string {
  if (entry.transaction_id === TRANSACTION_ID.achat_adhérent_par_virement
    && (entry.amounts[FINANCIAL_ACCOUNT.BANK_debit] ?? 0) > 0) {
    return 'VIREMENT';
  }
  if (entry.transaction_id === TRANSACTION_ID.achat_adhérent_par_carte
    || entry.transaction_id === TRANSACTION_ID.annulation_paiement_carte_adhérent) {
    const paymentChannel = this.card_payment_channel(entry);
    const isRefund = entry.transaction_id === TRANSACTION_ID.annulation_paiement_carte_adhérent;
    if (isRefund) {
      return paymentChannel === 'online'
        ? 'remboursement paiement en ligne'
        : 'remboursement paiement par carte';
    }
    if (paymentChannel === 'terminal') {
      return 'paiement par carte';
    }
    if (paymentChannel === 'online') {
      return 'paiement en ligne';
    }
    return 'paiement par carte';
  }
  return this.get_transaction(entry.transaction_id).label;
}

private card_payment_channel(entry: BookEntry): 'online' | 'terminal' | null {
  if (entry.stripeSessionId?.startsWith('pi_')) return 'terminal';
  if (entry.stripeSessionId?.startsWith('cs_')) return 'online';
  if (/^stripe:[A-Z0-9]{8}$/.test(entry.stripeTag ?? '')) return 'terminal';
  if (/^stripe:.{12}$/.test(entry.stripeTag ?? '')) return 'online';
  return null;
}

}
