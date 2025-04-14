import { Injectable } from '@angular/core';
import { TRANSACTION_CLASS, TRANSACTION_ENUM } from '../../../common/accounting.interface';
import { Transaction, Transactions_definition } from '../../../common/transaction.definition';
import { ToastService } from '../../../common/toaster/toast.service';

@Injectable({
  providedIn: 'root'
})
export class TransactionService {

  constructor(
    private toastService: ToastService,
  ) { }


class_to_types(op_class: TRANSACTION_CLASS): TRANSACTION_ENUM[] {
  let check = Object.values(TRANSACTION_CLASS).includes(op_class);
  if (check) {
    return Object.entries(Transactions_definition)
      .filter(([key, transaction]) => transaction.class === op_class)
      .map(([key, transaction]) => key as TRANSACTION_ENUM);
  } else {
    console.log('%s n\'est pas une clef de %s', op_class, JSON.stringify(Object.entries(TRANSACTION_CLASS)));
    throw new Error(`class ${op_class} not found`);
  }
}

transaction_to_class(entry_type: TRANSACTION_ENUM): TRANSACTION_CLASS {
  let check = Object.keys(Transactions_definition).includes(entry_type);
  if (check) {
    return Transactions_definition[entry_type].class;
  } else {
    this.toastService.showErrorToast('écriture comptable corrompue', `transaction " ${entry_type} " inconnue`);
    throw new Error(`transaction ${entry_type} not found`);
  }
}


get_transaction(entry_type: TRANSACTION_ENUM): Transaction {
  let check = Object.keys(Transactions_definition).includes(entry_type);
  if (check) {
    return Transactions_definition[entry_type];
  } else {
    this.toastService.showErrorToast('écriture comptable corrompue', `transaction " ${entry_type} " inconnue`);
    throw new Error(`transaction ${entry_type} not found`);
  }
}

}
