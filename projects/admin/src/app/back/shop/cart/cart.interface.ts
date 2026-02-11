import { CUSTOMER_ACCOUNT, FINANCIAL_ACCOUNT } from "../../../common/interfaces/accounting.interface";
import { Member } from "../../../common/interfaces/member.interface";
import { _CHEQUES_FIRST_IN_CASHBOX } from "../../../common/interfaces/transaction.definition";


export enum PaymentMode {
  CASH = 'espèces',
  CHEQUE = 'chèque',
  TRANSFER = 'virement',
  CREDIT = 'crédit',
  ASSETS = 'avoir',
  // CARD = 'carte',
}

export const SALE_ACCOUNTS: { [key in PaymentMode]: FINANCIAL_ACCOUNT | CUSTOMER_ACCOUNT } = {
  [PaymentMode.CASH]: FINANCIAL_ACCOUNT.CASHBOX_debit,
  [PaymentMode.CHEQUE]: _CHEQUES_FIRST_IN_CASHBOX ? FINANCIAL_ACCOUNT.CASHBOX_debit : FINANCIAL_ACCOUNT.BANK_debit,
  [PaymentMode.TRANSFER]: FINANCIAL_ACCOUNT.BANK_debit,
  [PaymentMode.CREDIT]: CUSTOMER_ACCOUNT.DEBT_debit,
  [PaymentMode.ASSETS]: CUSTOMER_ACCOUNT.ASSET_debit,
  // [PaymentMode.CARD]: FINANCIAL_ACCOUNT.CARD_OUT,
}


export interface Payment {
  amount: number;
  payer_id: string;
  mode: PaymentMode;
  bank: string;
  cheque_no: string;
}


export interface CartItem {
  payee?: Member | null;    // null => 2nd payee to fill-in
  paied: number;
  mutable : boolean; // true => item can be modified
  // payee_id: string;
  product_id: string;
  product_account: string;
  payee_name: string;
}

export interface Cart {
  items: CartItem[];
  debt: { name: string, amount: number } | null;
  asset_available: { name: string, amount: number } | null;
  asset_used: { name: string, amount: number } | null;
  take_asset : boolean;
  take_debt : boolean;
  buyer_name: string;
  tag ?: string;
}




