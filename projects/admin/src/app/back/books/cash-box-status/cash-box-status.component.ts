import { Component } from '@angular/core';
import { BookEntry, TRANSACTION_ID, FINANCIAL_ACCOUNT } from '../../../common/interfaces/accounting.interface';
import { BookService } from '../../services/book.service';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormArray, FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { _CHEQUE_IN_ACCOUNT, _CHEQUES_FIRST_IN_CASHBOX } from '../../../common/interfaces/transaction.definition';
import { SystemDataService } from '../../../common/services/system-data.service';
import { Bank } from '../../../common/interfaces/system-conf.interface';
import { map, switchMap, tap } from 'rxjs';
import { FinancialReportService } from '../../services/financial_report.service';
import { TransactionService } from '../../services/transaction.service';
import { ToastService } from '../../../common/services/toast.service';
import { BACK_ROUTE_PATHS } from '../../routes/back-route-paths';
import { Balance_sheet } from '../../../common/interfaces/balance.interface';

@Component({
  selector: 'app-cash-box-status',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
  templateUrl: './cash-box-status.component.html',
  styleUrl: './cash-box-status.component.scss'
})
export class CashBoxStatusComponent {

  season!: string;
  book_entries: BookEntry[] = [];
  cheques_in_cashbox: BookEntry[] = [];
  cheques_to_process_amount: number = 0;
  cheques_to_process_number: number = 0;
  cheques_undrawn_amount: number = 0;
  cheques_undrawn_number: number = 0;
  cheques_drawn_amount: number = 0;
  cheques_drawn_number: number = 0;

  unchecked_deposit_refs: BookEntry[] = [];
  temp_refs: Map<string, { cheque_qty: number, amount: number, new_ref: string }> = new Map<string, { cheque_qty: number, amount: number, new_ref: string }>();
  temp_refs_number: number = 0;
  current_cash_amount: number = 0;
  cash_for_deposit: BookEntry[] = [];
  cash_for_deposit_amount: number = 0;
  cash_to_deposit_amount: number = 0;
  banks !: Bank[];
  truncature = '1.2-2';  // '1.0-0';// '1.2-2';  //

  prev_balance_sheet!: Balance_sheet

  CHEQUE_IN_ACCOUNT = _CHEQUE_IN_ACCOUNT;

  cashForm!: FormGroup;
  cashBoxForm!: FormGroup;

  constructor(
    private bookService: BookService,
    private transactionService: TransactionService,
    private systemDataService: SystemDataService,
    private financialService: FinancialReportService,
    private toastService: ToastService,
    private fb: FormBuilder,
  ) { }


  ngOnInit() {

    this.cashForm = this.fb.group({
      cash_out_amount: ['', this.cash_out_validator],
      cash_real_amount: ['', [Validators.required, Validators.min(0)]],
      cheques_to_process: this.fb.array([]),
      deposits_to_confirm: this.fb.array([]),
    });

    this.systemDataService.get_configuration().pipe(
      map((conf) => {
        this.banks = conf.banks;
        this.season = conf.season;
        return conf;
      }),
      switchMap((conf) =>
        this.financialService.read_balance_sheet(this.systemDataService.previous_season(conf.season))
      ),
      tap((prev_balance_sheet) => {
        this.prev_balance_sheet = prev_balance_sheet;
      }),
      switchMap(() => this.bookService.list_book_entries())
    )
      .subscribe((book_entries) => {
        this.book_entries = book_entries;

        // filtre les chèques à déposer
        this.cheques_in_cashbox = book_entries
          .filter(book_entry => this.transactionService.get_transaction(book_entry.transaction_id).cheque === 'in')
          .filter(book_entry => book_entry.cheque_ref !== undefined && (book_entry.deposit_ref === '' || book_entry.deposit_ref === null));

        this.cheques_to_process_amount = this.cheques_in_cashbox.reduce((acc, book_entry) => {
          return acc + (book_entry.amounts['cashbox_in'] ?? 0);
        }, 0);

        this.cheques_to_process_number = this.cheques_in_cashbox.length;
        this.cheques_undrawn_number = this.cheques_in_cashbox.length;
        this.cheques_undrawn_amount = this.cheques_to_process_amount;
        this.cheques_drawn_number = 0;
        this.cheques_drawn_amount = 0;
        // Initialise le FormArray cheques_to_process

        // Sauvegarde les sélections actuelles avant de recréer le FormArray
        const previousSelections = new Map<string, boolean>();
        this.chequesToProcess.controls.forEach(ctrl => {
          previousSelections.set(ctrl.get('id')?.value, ctrl.get('drawn')?.value ?? false);
        });

        const chequesArray = this.fb.array(
          this.cheques_in_cashbox.map(book_entry => this.fb.group({
            id: [book_entry.id],
            drawn: [previousSelections.get(book_entry.id) ?? false]
          }))
        );
        this.cashForm.setControl('cheques_to_process', chequesArray);

        // Recalcule les compteurs drawn/undrawn en fonction des sélections restaurées
        this.cheques_drawn_number = 0;
        this.cheques_drawn_amount = 0;
        this.cheques_undrawn_number = 0;
        this.cheques_undrawn_amount = 0;
        this.cheques_in_cashbox.forEach(book_entry => {
          if (previousSelections.get(book_entry.id)) {
            this.cheques_drawn_number++;
            this.cheques_drawn_amount += book_entry.amounts['cashbox_in'] ?? 0;
          } else {
            this.cheques_undrawn_number++;
            this.cheques_undrawn_amount += book_entry.amounts['cashbox_in'] ?? 0;
          }
        });

        console.log('chequesArray', chequesArray);

        // calcule le montant en caisse (cheques + espèces  )
        this.current_cash_amount = this.prev_balance_sheet.cash + this.bookService.get_cash_movements_amount();

        // énumère les bordereaux de dépot chèque en temp_
        this.temp_refs.clear();
        this.book_entries
          .filter(book_entry => this.transactionService.get_transaction(book_entry.transaction_id).cheque === 'in')
          .forEach(book_entry => {
            if (book_entry.deposit_ref && book_entry.deposit_ref.startsWith('TEMP_')) {
              this.temp_refs.set(book_entry.deposit_ref, {
                amount: (this.temp_refs.get(book_entry.deposit_ref)?.amount ?? 0) + (book_entry.amounts?.[this.CHEQUE_IN_ACCOUNT] ?? 0),
                cheque_qty: (this.temp_refs.get(book_entry.deposit_ref)?.cheque_qty ?? 0) + 1,
                new_ref: ''
              });
            }
          });
        const depositsArray = this.fb.array(
          Array.from(this.temp_refs.entries()).map(([key, value]) => this.fb.group({
            temp_ref: [key],
            cheque_qty: [value.cheque_qty],
            amount: [value.amount],
            new_ref: ['', Validators.required]
          }))
        );
        this.cashForm.setControl('deposits_to_confirm', depositsArray);
        this.temp_refs_number = this.temp_refs.size;


        //énumère les retraits espèces sans reference de relevé bancaire
        this.cash_for_deposit = this.book_entries
          .filter(book_entry => book_entry.transaction_id === TRANSACTION_ID.dépôt_caisse_espèces)
          .filter(book_entry => !book_entry.bank_report);
        this.cash_for_deposit_amount = this.cash_for_deposit.reduce((acc, book_entry) => {
          return acc + (book_entry.amounts['cashbox_out'] ?? 0);
        }, 0);

        // énumère les montants chèques avec référence de dépôt définitifs non pointés
        this.unchecked_deposit_refs = this.book_entries
          .filter(book_entry => book_entry.transaction_id === TRANSACTION_ID.dépôt_caisse_chèques)
          .filter(book_entry => book_entry.deposit_ref && !book_entry.deposit_ref.startsWith('TEMP_'))
          .filter(book_entry => !book_entry.bank_report);

      });
    // TRANSACTION_ID.dépôt_caisse_chèques
  }

  get chequesToProcess() {
    return this.cashForm.get('cheques_to_process') as FormArray;
  }

  get depositsToConfirm() {
    return this.cashForm.get('deposits_to_confirm') as FormArray;
  }

  get cash_out_amount(): FormControl {
    return this.cashForm.get('cash_out_amount') as FormControl;
  }

  get cash_real_amount(): FormControl {
    return this.cashForm.get('cash_real_amount') as FormControl;
  }

  // gestion des espèces en caisse
  //   choix du montant à retirer et création d'un mouvement de dépot

  create_cash_out_entry(amount: number) {
    if (amount <= 0 || isNaN(amount)) {
      throw new Error('create_cash_out_entry: amount must be greater than 0');
    }

    let cash_out: BookEntry = {
      season: this.season,
      date: new Date().toISOString().split('T')[0],
      transaction_id: TRANSACTION_ID.dépôt_caisse_espèces,
      amounts: {
        [FINANCIAL_ACCOUNT.CASHBOX_credit]: amount,
        [FINANCIAL_ACCOUNT.BANK_debit]: amount
      },
      operations: [],
      deposit_ref: 'retrait caisse du ' + new Date().toISOString().split('T')[0],
      id: ''
    }
    this.bookService.create_book_entry(cash_out).then(() => {
      this.toastService.showSuccess('Retrait de caisse consigné', `Montant : ${amount.toFixed(2)} €`);
    });
  }

  // gestion des chèques à déposer

  // 1. marquage en temporaire des chèques à déposer :
  //     les chèques sont listés et marqués (ref temporaire) en attente du bordereau de dépôt
  cheques_check_out() {
    let temp_ref = 'TEMP_' + new Date().toISOString();
    this.chequesToProcess.controls.forEach((book_entry) => {
      if (book_entry.get('drawn')?.value === true) {
        const cheque = this.cheques_in_cashbox.find(be => be.id === book_entry.get('id')?.value);
        if (cheque) {
          cheque.deposit_ref = temp_ref;
          this.bookService.update_book_entry(cheque);
        } else {
          throw new Error('cheques_check_out: cheque not found');
        }
      }
    });

  }

  // 2. validation du dépôt des chèques
  //     les chèques sont référencés définitivement (ref de bordereau dépot définitif)
  //     un mouvement de dépôt est créé (cash-out -> bank_in) si _CHEQUE_IN_CASHBOX mode

  validate_deposit(ref: AbstractControl) {
    // récupération des infos du bordereau  }) {
    // mise à jour des références de dépôt des chèques

    // temp_ref -> tobe_ref
    this.book_entries.map(entry => {
      if (entry.deposit_ref === ref.value.temp_ref) {
        entry.deposit_ref = ref.value.new_ref;
        this.bookService.update_book_entry(entry);
      }
    });
    // création du mouvement de dépôt si _CHEQUES_FIRST_IN_CASHBOX
    if (_CHEQUES_FIRST_IN_CASHBOX) {
      this.create_dépôt_caisse_chèques_entry(ref.value.amount, ref.value.new_ref);
    }
  }

  create_dépôt_caisse_chèques_entry(value: number, ref: string) {
    let dépôt_caisse_chèques: BookEntry = {
      season: this.season,
      date: new Date().toISOString().split('T')[0],
      transaction_id: TRANSACTION_ID.dépôt_caisse_chèques,
      amounts: {
        [FINANCIAL_ACCOUNT.CASHBOX_credit]: value,
        [FINANCIAL_ACCOUNT.BANK_debit]: value
      },
      deposit_ref: ref,
      operations: [],
      id: ''
    }
    this.bookService.create_book_entry(dépôt_caisse_chèques);
  }



  // calls HTML

  cash_align() {
    if (this.cashForm.get('cash_real_amount')?.value !== null) {
      let correction = this.cashForm.get('cash_real_amount')?.value - (this.current_cash_amount - this.cash_for_deposit_amount);
      correction = Math.round(correction * 100) / 100;
      if (correction !== 0) {
        this.bookService.cashbox_alignment(correction).then(() => {
          this.toastService.showSuccess('Alignement caisse consigné', `Montant : ${correction.toFixed(2)} €`);
        })
          .catch((err) => {
            this.toastService.showErrorToast('Erreur lors de l\'alignement de la caisse', `Erreur : ${err.message}`);
          })
          .finally(() => {
            this.cashForm.get('cash_real_amount')?.reset();
          });
      }
    }
  }

  cash_out() {
    if (this.cash_out_amount.value !== 0) {
      this.create_cash_out_entry(this.cash_out_amount.value);
      this.cashForm.get('cash_out_amount')?.reset();
    }
  }

  cash_out_validator = (control: AbstractControl): { [key: string]: boolean } | null => {
    if (!control.value) { return null };
    const cash_out_amount = control.value;
    if (cash_out_amount > this.current_cash_amount || cash_out_amount < 0) {
      return { out_of_bounds: true };
    }
    return null;
  }


  get_date_from_temporary_deposit_ref(ref: string | undefined): string {
    if (ref === undefined) {
      throw new Error('get_date_of_temporary_deposit_ref : ref is undefined');
    }
    let date = ref.split('TEMP_')[1].split('T')[0];
    return new Date(date).toLocaleDateString();
  }


  draw(ctrl: AbstractControl, drawn: boolean): void {
    const book_entry = this.cheques_in_cashbox.find(be => be.id === ctrl.get('id')?.value);
    if (!book_entry) {
      throw new Error('draw: book_entry not found');
    }
    if (drawn) {
      this.cheques_undrawn_number--;
      this.cheques_undrawn_amount -= book_entry.amounts['cashbox_in'] ?? 0;
      this.cheques_drawn_number++;
      this.cheques_drawn_amount += book_entry.amounts['cashbox_in'] ?? 0;
    } else {
      this.cheques_undrawn_number++;
      this.cheques_undrawn_amount += book_entry.amounts['cashbox_in'] ?? 0;
      this.cheques_drawn_number--;
      this.cheques_drawn_amount -= book_entry.amounts['cashbox_in'] ?? 0;
    }
  }

  develop_bank_ref(ref: string | undefined): { num: string, bank: string } {
    if (ref === undefined) {
      throw new Error('develop_bank_ref : ref is undefined');
    }
    let bank = this.banks.find(bank => ref.startsWith(bank.key));
    if (bank) {
      return { num: ref.split(bank.key)[1], bank: bank.name };
    }
    return { num: ref, bank: '' };
  }

  reconciliation_path() {
    return '/back/' + BACK_ROUTE_PATHS.BankReconciliation;
  }

}
