import { Injectable } from '@angular/core';
import { BOOK_ENTRY_CLASS, ENTRY_TYPE } from '../../../common/accounting.interface';
import { TRANSACTIONS, Transaction } from '../../../common/transaction.definition';
import { ToastService } from '../../../common/toaster/toast.service';

@Injectable({
  providedIn: 'root'
})
export class TransactionService {

  constructor(
    private toastService: ToastService,
  ) { }


class_to_types(op_class: BOOK_ENTRY_CLASS): ENTRY_TYPE[] {
  let check = Object.values(BOOK_ENTRY_CLASS).includes(op_class);
  if (check) {
    return Object.entries(TRANSACTIONS)
      .filter(([key, transaction]) => transaction.class === op_class)
      .map(([key, transaction]) => key as ENTRY_TYPE);
  } else {
    console.log('%s n\'est pas une clef de %s', op_class, JSON.stringify(Object.entries(BOOK_ENTRY_CLASS)));
    throw new Error(`class ${op_class} not found`);
  }
}

get_transaction(entry_type: ENTRY_TYPE): Transaction {
  let check = Object.keys(TRANSACTIONS).includes(entry_type);
  if (check) {
    return TRANSACTIONS[entry_type];
  } else {
    this.toastService.showErrorToast('service transaction', `transaction ${entry_type} not found`);
    throw new Error(`transaction ${entry_type} not found`);
  }
}

}
