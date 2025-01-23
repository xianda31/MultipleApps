import { Component } from '@angular/core';
import { Bookentry, BANK_OPERATION_TYPE, RECORD_CLASS } from '../../../../../common/accounting.interface';
import { BookService } from '../../book.service';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { get_transaction } from '../../../../../common/transaction.definition';
import { SystemDataService } from '../../../../../common/services/system-data.service';
import { Bank } from '../../../../../common/system-conf.interface';

@Component({
  selector: 'app-cash-box-status',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './cash-box-status.component.html',
  styleUrl: './cash-box-status.component.scss'
})
export class CashBoxStatusComponent {

  season: string = '2024/2025';
  book_entries: Bookentry[] = [];
  cheques_for_deposit: Bookentry[] = [];
  current_cash_amount: number = 0;
  cash_out_amount: number = 0;
  temp_refs: Map<string, { cheque_qty: number, amount: number, new_ref: string }> = new Map<string, { cheque_qty: number, amount: number, new_ref: string }>();
  banks !: Bank[];

  cashForm!: FormGroup;
  coins = ['2€', '1€', '0,50€', '0,20€', '0,10€'];


  constructor(
    private bookService: BookService,
    private systemDataService: SystemDataService,
    private fb: FormBuilder
  ) { }


  ngOnInit() {

    this.init_cashForm();

    this.systemDataService.configuration$.subscribe((conf) => {
      this.banks = conf.banks;
    });
    this.bookService.list_book_entries$().subscribe((book_entries) => {
      this.book_entries = book_entries;
      this.current_cash_amount = this.cash_balance(book_entries);

      // filtre les chèques à déposer
      this.cheques_for_deposit = book_entries
        .filter(book_entry => book_entry.bank_op_type === BANK_OPERATION_TYPE.cheque_receipt)
        .filter(book_entry => book_entry.cheque_ref !== undefined && (book_entry.deposit_ref === null));

      // énumère les bordereaux de dépot chèque en temp_
      this.temp_refs.clear();
      this.book_entries
        .filter(book_entry => book_entry.bank_op_type === BANK_OPERATION_TYPE.cheque_receipt)
        .forEach(book_entry => {
          if (book_entry.deposit_ref && book_entry.deposit_ref.startsWith('temp_')) {
            this.temp_refs.set(book_entry.deposit_ref, {
              amount: (this.temp_refs.get(book_entry.deposit_ref)?.amount ?? 0) + (book_entry.amounts['cashbox_in'] ?? 0),
              cheque_qty: (this.temp_refs.get(book_entry.deposit_ref)?.cheque_qty ?? 0) + 1,
              new_ref: ''
            });
          }
        });
    });
  }
  check_out() {
    if (this.cash_out_amount !== 0) {
      this.create_cash_out_entry(this.cash_out_amount);
      this.cash_out_amount = 0;
    }
    this.cheques_check_out();
  }

  // gestion des espèces en caisse
  //   choix du montant à retirer et création d'un mouvement de dépot

  create_cash_out_entry(amount: number) {
    let transaction = get_transaction(RECORD_CLASS.MOVEMENT, BANK_OPERATION_TYPE.cash_deposit);
    let cash_out: Bookentry = {
      season: this.season,
      date: new Date().toISOString().split('T')[0],
      class: RECORD_CLASS.MOVEMENT,
      bank_op_type: BANK_OPERATION_TYPE.cash_deposit,
      amounts: {
        [transaction.account_to_credit as string]: amount,
        [transaction.account_to_debit as string]: amount
      },
      operations: [],
      id: ''
    }
    this.bookService.create_book_entry(cash_out);
  }

  // gestion des chèques en caisse

  // 1. marquage en temporaire des chèques à déposer : 
  //     les chèques sont listés et marqués (ref temporaire) pour un dépôt futur (restent en caisse)

  cheques_check_out() {
    let temp_ref = 'temp_' + new Date().toISOString();
    this.cheques_for_deposit.forEach((book_entry) => {
      if (typeof book_entry.deposit_ref === "boolean" && book_entry.deposit_ref === true) {
        book_entry.deposit_ref = temp_ref;
        this.bookService.update_book_entry(book_entry);
      }
    });
  }

  // 2. validation du dépôt des chèques
  //     les chèques sont référencés définitivement (ref de bordereau dépot définitif)
  //     un mouvement de dépôt est créé (cash-out -> bank_in)

  validate_deposit(ref: { key: string, value: { amount: number, new_ref: string } }) {
    // temp_ref -> tobe_ref
    this.book_entries.map(entry => {
      if (entry.deposit_ref === ref.key) {
        entry.deposit_ref = ref.value.new_ref;
        this.bookService.update_book_entry(entry);
      }
    });
    // création du mouvement de dépôt
    this.create_cheque_deposit_entry(ref.value.amount, ref.value.new_ref);
  }
  create_cheque_deposit_entry(value: number, ref: string) {
    let transaction = get_transaction(RECORD_CLASS.MOVEMENT, BANK_OPERATION_TYPE.cheque_deposit);
    let cheque_deposit: Bookentry = {
      season: this.season,
      date: new Date().toISOString().split('T')[0],
      class: RECORD_CLASS.MOVEMENT,
      bank_op_type: BANK_OPERATION_TYPE.cheque_deposit,
      amounts: {
        [transaction.account_to_credit as string]: value,
        [transaction.account_to_debit as string]: value
      },
      deposit_ref: ref,
      operations: [],
      id: ''
    }
    this.bookService.create_book_entry(cheque_deposit);
  }


  // utilitaires

  cash_balance(entries: Bookentry[]): number {
    // calculer le montant disponible en espèces
    return entries.reduce((acc, book_entry) => {
      switch (book_entry.bank_op_type) {
        case BANK_OPERATION_TYPE.cash_receipt:
          return acc + (book_entry.amounts['cashbox_in'] || 0);
        case BANK_OPERATION_TYPE.cash_deposit:
          return acc - (book_entry.amounts['cashbox_out'] || 0);
        default:
          return acc;
      }
    }, 0);
  }

  get_date_of_temporary_deposit_ref(ref: string | undefined): string {
    if (ref === undefined) {
      throw new Error('get_date_of_temporary_deposit_ref : ref is undefined');
    }
    let date = ref.split('temp_')[1].split('T')[0];
    return new Date(date).toLocaleDateString();
  }

  some_cheque_selected_for_deposit(): boolean {
    return this.cheques_for_deposit.some(book_entry => typeof book_entry.deposit_ref === "boolean" && book_entry.deposit_ref === true);
  }

  develop_bank_ref(ref: string | undefined): string {
    if (ref === undefined) {
      throw new Error('develop_bank_ref : ref is undefined');
    }
    let bank = this.banks.find(bank => ref.startsWith(bank.key));
    if (bank) {
      return bank.name + ' n°' + ref.split(bank.key)[1];
    }
    return ref;
  }

  // inventaire monnaie en caisse
  init_cashForm() {
    this.cashForm = this.fb.group({
      '2€': [0],
      '1€': [0],
      '0,50€': [0],
      '0,20€': [0],
      '0,10€': [0],
    });
  }
}
