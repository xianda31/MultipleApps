import { Injectable } from '@angular/core';
import {  TRANSACTION_ID } from '../../../common/accounting.interface';
import { Transaction, TRANSACTION_CLASS, TRANSACTION_DIRECTORY } from '../../../common/transaction.definition';
import { ToastService } from '../../../common/toaster/toast.service';

@Injectable({
  providedIn: 'root'
})
export class TransactionService {

  constructor(
    private toastService: ToastService,
  ) { }


class_to_enums(_class: TRANSACTION_CLASS): TRANSACTION_ID[] {
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
    this.toastService.showErrorToast('écriture comptable corrompue', `transaction " ${id} " inconnue`);
    throw new Error(`transaction ${id} not found`);
  }
}

list_transaction_classes(): TRANSACTION_CLASS[] {
 return [
   TRANSACTION_CLASS.REVENUE_FROM_MEMBER,
  TRANSACTION_CLASS.OTHER_REVENUE,
  TRANSACTION_CLASS.EXPENSE_FOR_MEMBER,
  TRANSACTION_CLASS.OTHER_EXPENSE,
  TRANSACTION_CLASS.MOVEMENT,
  TRANSACTION_CLASS.BALANCE
 ]
}

get_transaction(id: TRANSACTION_ID): Transaction {
  let check = Object.keys(TRANSACTION_DIRECTORY).includes(id);
  if (check) {
    return TRANSACTION_DIRECTORY[id];
  } else {
    this.toastService.showErrorToast('écriture comptable corrompue', `transaction " ${id} " inconnue`);
    throw new Error(`transaction ${id} not found`);
  }
}

}
