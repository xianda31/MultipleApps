
import { CommonModule, formatDate } from '@angular/common';
import { Component, ViewEncapsulation } from '@angular/core';
import { Location } from '@angular/common';
import { AbstractControl, FormArray, FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { BookService } from '../../services/book.service';
import { BookEntry, operation_values, Operation, FINANCIAL_ACCOUNT, TRANSACTION_ID, BALANCE_ACCOUNT } from '../../../common/interfaces/accounting.interface';
import { Bank } from '../../../common/interfaces/system-conf.interface';
import { SystemDataService } from '../../../common/services/system-data.service';
import { Transaction, Account_def, TRANSACTION_CLASS } from '../../../common/interfaces/transaction.definition';
import { Member } from '../../../common/interfaces/member.interface';
import { ActivatedRoute } from '@angular/router';
import { from, Subscription } from 'rxjs';
import { NgbModal, NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { BackComponent } from '../../../common/loc-back/loc-back.component';
import { MembersService } from '../../../common/services/members.service';
import { TransactionService } from '../../services/transaction.service';
import { ToastService } from '../../../common/services/toast.service';
import { InvoiceSelectComponent } from '../invoice-select/invoice-select';
import { InvoiceService } from '../../../common/services/invoice.service';
    import { combineLatest, of } from 'rxjs';
    import { switchMap, take, map } from 'rxjs/operators';
    
interface Operation_initial_values {
  optional_accounts?: string[];
  label?: string;
  member?: string;
  values?: { [key: string]: number };
}

interface Account {
  key: string;
  description: string;
}
@Component({
  selector: 'app-booking',
  standalone: true,
  encapsulation: ViewEncapsulation.None, // nécessaire pour que les CSS des tooltips fonctionnent
  imports: [CommonModule, FormsModule, ReactiveFormsModule, NgbTooltipModule],
  templateUrl: './books-editor.component.html',
  styleUrl: './books-editor.component.scss'
})
export class BooksEditorComponent {

  NumberRegexPattern: string = '([-,+]?[0-9]+([.,][0-9]*)?|[.][0-9]+)';
  // NumberRegexPattern: string = '([0-9]+([.,][0-9]*)?|[.][0-9]+)';

  protected_mode: boolean = false; // pour le mode protégé

  book_entry_id!: string;
  banks !: Bank[];
  club_bank!: Bank;
  members!: Member[];
  expenses_accounts !: Account[];
  products_accounts !: Account[];
  // expense_or_revenue_accounts !: Account[];

  financial_accounts !: Account_def[];
  optional_accounts !: Account_def[];

  transaction_ids !: TRANSACTION_ID[];

  transaction_classes !: TRANSACTION_CLASS[];
  // class_descriptions = Object(Class_descriptions);

  form!: FormGroup;

  form_ready = false;
  season!: string;
  creation = false;
  financial_accounts_locked = true;

  deposit_ref_changed = false;
  selected_book_entry!: BookEntry;

  selected_transaction: Transaction | undefined = undefined;

  operations_valueChanges_subscription!: Subscription;

  // Store subscriptions for valueChanges
  transacClassSubscription!: Subscription;
  transactionIdSubscription!: Subscription;

  constructor(
    private fb: FormBuilder,
    private bookService: BookService,
    private transactionService: TransactionService,
    private systemDataService: SystemDataService,
    private membersService: MembersService,
    private invoiceService: InvoiceService,
    private modalService: NgbModal,
    private toastService: ToastService,
    private route: ActivatedRoute,
    private location: Location

  ) { }

  ngOnInit() {
    this.transaction_ids = [];
    this.transaction_classes = this.transactionService.list_transaction_classes();

    // Charger les membres une seule fois
    this.membersService.listMembers().subscribe((members) => {
      this.members = members;
    });

    // Combine route data, params et configuration


    combineLatest([
      this.route.data,
      this.route.params,
      this.systemDataService.get_configuration()
    ]).pipe(
      take(1),
      switchMap(([data, params, conf]) => {
        let access = data['access'];
        this.protected_mode = !(access && (access === 'full'));
        this.season = conf.season;
        this.banks = conf.banks;
        this.club_bank = this.banks.find(bank => bank.key === conf.club_bank_key)!;
        this.expenses_accounts = conf.revenue_and_expense_tree.expenses;
        this.products_accounts = conf.revenue_and_expense_tree.revenues;
        this.init_form();
        this.book_entry_id = params['id'];
        this.creation = (this.book_entry_id === undefined);
        if (!this.creation) {
          return from(this.bookService.read_book_entry(this.book_entry_id)).pipe(
            map((book_entry) => ({ book_entry }))
          );
        } else {
          return of({ book_entry: null });
        }
      })
    ).subscribe({
      next: (result: any) => {
        if (result.book_entry) {
          this.selected_book_entry = result.book_entry;
          console.log('book entry loaded:', result.book_entry);
          this.set_form(result.book_entry);
          this.valueChanges_subscribe();
          this.form_ready = true;
        } else {
          this.valueChanges_subscribe();
          this.form_ready = true;
        }
      },
      error: (error: any) => {
        throw new Error('error reading book_entry', error);
      }
    });
  }

  operations_valueChanges_subscribe() { // operation change handler pour le calcul du total

    if (this.operations.get('values') === undefined) {
      return; // pas d'opérations à gérer
    }
    this.operations_valueChanges_subscription = this.operations.valueChanges.subscribe((op_values) => {
      op_values.forEach((values: Operation_initial_values, index: number) => {
        let total: number = this.sum_operation_values(this.selected_transaction!, values);
        (this.operations.at(index) as FormGroup).controls['total'].setValue(total, { emitEvent: false });
      });
    });
  }



  init_form() {
    const today = formatDate(new Date(), 'yyyy-MM-dd', 'en');
    this.selected_transaction = undefined;
    this.form = this.fb.group({
      'id': [''],
      'date': [today, [Validators.required, this.dateSeasonValidator]],
      'transac_class': ['', Validators.required],
      'transaction_id': ['', Validators.required],
      'amounts': new FormArray([]),
      'tag': [''],
      'bank_name': [''],
      'cheque_number': [''],
      'deposit_ref': [''],
      'invoice_ref': [''],
      'operations': new FormArray([]),
    });
  }


  set_form(book_entry: BookEntry) {

    this.selected_transaction = this.transactionService.get_transaction(book_entry.transaction_id);
    let transac_class = this.selected_transaction.class;
    this.financial_accounts = this.selected_transaction.financial_accounts;


    this.form.patchValue({
      id: book_entry.id,
      date: book_entry.date,
      transac_class: transac_class,
      transaction_id: book_entry.transaction_id,
      tag: book_entry.tag,
      bank_name: book_entry.cheque_ref?.slice(0, 3),
      cheque_number: book_entry.cheque_ref?.slice(3),
      deposit_ref: book_entry.deposit_ref,
      invoice_ref: book_entry.invoice_ref ?? '',
    });

    this.transaction_ids = this.transactionService.class_to_ids(transac_class);

    this.form.get('transac_class')?.disable();   // bloque le changment de la classe d'opération

    // création des champs amounts
    this.init_financial_accounts(this.selected_transaction, this.protected_mode);

    this.financial_accounts.forEach((account) => {
      let value = book_entry.amounts[account.key as FINANCIAL_ACCOUNT] ?? '';
      (this.form.controls['amounts'] as FormArray).controls[this.financial_accounts.indexOf(account)].setValue(value);
    });


    // création des champs operations
    this.operations.clear();
    book_entry.operations.forEach((operation) => {
      this.add_operation(this.selected_transaction!, operation);
    });
    this.operations_valueChanges_subscribe();


  };



  reset_form() {

    this.financial_accounts_locked = true;
    this.selected_transaction = undefined;
    this.transaction_ids = [];
    // Unsubscribe from valueChanges before reset
    this.transacClassSubscription?.unsubscribe();
    this.transactionIdSubscription?.unsubscribe();
    this.operations_valueChanges_subscription?.unsubscribe();
    this.form.reset();
    this.operations.clear();
    this.amounts.clear();
    this.form.controls['date'].setValue(formatDate(new Date(), 'yyyy-MM-dd', 'en'));
    // Re-subscribe after reset
    this.valueChanges_subscribe();
    this.operations_valueChanges_subscribe();
  }

  valueChanges_subscribe() {
    // Prevent multiple subscriptions
    this.transacClassSubscription?.unsubscribe();
    this.transactionIdSubscription?.unsubscribe();
    this.operations_valueChanges_subscription?.unsubscribe();

    // form.transaction_class change handler
    this.transacClassSubscription = this.form.controls['transac_class'].valueChanges.subscribe((op_class) => {
      this.selected_transaction = undefined;
      this.transaction_ids = this.transactionService.class_to_ids(op_class);
      this.financial_accounts_locked = true;
    });

    // form.transaction_id change handler
    this.transactionIdSubscription = this.form.controls['transaction_id'].valueChanges.subscribe((transaction_id) => {
      this.selected_transaction = this.transactionService.get_transaction(transaction_id);

      if (this.selected_transaction.cheque === 'out') {
        this.form.controls['bank_name'].disable();
      }

      // initialisation form operations si en mode création
      if (this.creation) {
        this.operations.clear();
        this.add_operation(this.selected_transaction);
      }

      // operations valueChanges subscription s'il y a des valeurs charges ou produits
      this.operations_valueChanges_subscribe();

      // gestion des validators pour les champs bank_name et cheque_ref
      this.handle_cheque_info_validators(this.selected_transaction);
      // création des champs amounts
      if (this.creation) {
        this.amounts.clear();
        this.init_financial_accounts(this.selected_transaction, this.protected_mode);
      }
    });

    // form.deposit_ref change handler
    this.form.controls['deposit_ref'].valueChanges.subscribe((deposit_ref) => {
      if (!this.creation) {
        if (this.form.controls['transaction_id'].value === TRANSACTION_ID.dépôt_caisse_chèques) {
          this.deposit_ref_changed = true;
        }
      };
    });
  }

  sum_operation_values(transaction: Transaction, values: Operation_initial_values): number {

    let total: number = 0;
    let expense_or_revenue_accounts = this.expense_or_revenue_accounts(transaction);
    expense_or_revenue_accounts.forEach((account, index) => {
      let value = this.parse_to_float(values.values?.[index]?.toString() ?? '');
      total += value;
    });
    let optional_accounts = transaction.optional_accounts;
    if (optional_accounts !== undefined) {
      optional_accounts.forEach((account, index) => {
        let value = this.parse_to_float(values.optional_accounts?.[index]?.toString() ?? '');
        if (!transaction.revenue_account_to_show) { value = -value; }
        if (account.key.endsWith('_in')) { total -= value; }
        if (account.key.endsWith('_out')) { total += value; }
      });
    }
    return total;
  }

  handle_cheque_info_validators(transaction: Transaction) {
    switch (transaction.cheque) {
      case 'in':
        this.form.controls['bank_name'].setValidators([Validators.required]);
        this.form.controls['cheque_number'].setValidators([Validators.required]);
        break;
      case 'out':
        this.form.controls['bank_name'].setValue(this.club_bank.key);
        this.form.controls['bank_name'].disable();
        this.form.controls['bank_name'].setValidators([Validators.required]);
        this.form.controls['cheque_number'].setValidators([Validators.required]);
        break;
      case 'none':
        this.form.controls['bank_name'].reset();
        this.form.controls['bank_name'].clearValidators();
        this.form.controls['cheque_number'].reset();
        this.form.controls['cheque_number'].clearValidators();
        break;
    }

    this.form.controls['bank_name'].updateValueAndValidity();
    this.form.controls['cheque_number'].updateValueAndValidity();
  }

  delete_operation(index: number) {
    this.operations.removeAt(index);
  }

  add_operation(transaction: Transaction, operation_initial?: Operation) {

    let expense_or_revenue_accounts = this.expense_or_revenue_accounts(transaction);
    let operationForm: FormGroup = this.fb.group({
      'label': [operation_initial?.label ?? ''],
      'total': { value: (operation_initial?.values ? this.sum_operation_values(transaction, operation_initial) : ''), disabled: true },
    });


    if (transaction.nominative) {
      operationForm.addControl('member', new FormControl(operation_initial?.member ?? '', Validators.required));
      if (transaction.optional_accounts !== undefined) {
        this.optional_accounts = transaction.optional_accounts;
        operationForm.addControl('optional_accounts', this.fb.array(
          this.optional_accounts.map((account_def) => new FormControl<string>((operation_initial?.values?.[account_def.key]?.toString() ?? ''), [Validators.pattern(this.NumberRegexPattern)]))
        ));
      }
    }

    if (expense_or_revenue_accounts.length !== 0) {
      operationForm.addControl('values', this.fb.array(
        expense_or_revenue_accounts.map((account_def) => new FormControl<string>((operation_initial?.values?.[account_def.key]?.toString() ?? ''), [Validators.pattern(this.NumberRegexPattern)])),
        { validators: [this.atLeastOneFieldValidator] }));
    }

    this.operations.push(operationForm);

  }

  init_financial_accounts(transaction: Transaction, protected_mode: boolean) {

    if (protected_mode) {
      // Map keys to Account_def objects
      this.financial_accounts = transaction.financial_accounts.filter(account =>
        (transaction.financial_accounts_to_charge as (FINANCIAL_ACCOUNT | BALANCE_ACCOUNT)[]).includes(account.key as FINANCIAL_ACCOUNT | BALANCE_ACCOUNT)
      );
    } else {
      this.financial_accounts = transaction.financial_accounts;
    }
    this.financial_accounts.forEach((account) => {
      if (transaction.financial_accounts_to_charge.includes(account.key as FINANCIAL_ACCOUNT | BALANCE_ACCOUNT)) {
        this.amounts.push(new FormControl('', [Validators.required, Validators.pattern(this.NumberRegexPattern)]));
      }
      else {
        this.amounts.push(new FormControl({ value: '', disabled: true }, [Validators.pattern(this.NumberRegexPattern)]));
      }
    });
  }

  handle_financial_accounts_enabling(transaction: Transaction) {
    this.financial_accounts.forEach((account, index) => {
      if (transaction.financial_accounts_to_charge.includes(account.key as FINANCIAL_ACCOUNT | BALANCE_ACCOUNT)) {
        this.amounts.controls[index].setValidators([Validators.required, Validators.pattern(this.NumberRegexPattern)]);
        this.amounts.controls[index].enable();
      } else {
        this.amounts.controls[index].disable();
        this.amounts.controls[index].clearValidators();
      }
    });
  }

  lock_unlock_financial_accounts() {
    if (this.financial_accounts_locked) {
      this.amounts.controls.forEach((control) => {
        control.enable();
      });
      this.financial_accounts_locked = false;
    } else {
      this.financial_accounts_locked = true;
      this.handle_financial_accounts_enabling(this.selected_transaction!);
    }
  }

  onSubmit() {
    let operations: Operation[] = [];
    let amounts: { [key: string]: number } = {};
    let transaction = this.transactionService.get_transaction(this.transaction_id);
    let expense_or_revenue_accounts = this.expense_or_revenue_accounts(transaction);
    // constructions des montants

    this.financial_accounts.forEach((account: Account_def, index: number) => {

      let value = ((this.form.controls['amounts'] as FormArray).controls[index].value);
      if (value && value !== '') {
        amounts[account.key] = this.parse_to_float(value);
      }
    });

    // construction des opérations

    operations = this.operations.controls.map((operation) => {
      let op_values: operation_values = {};

      expense_or_revenue_accounts.forEach((account: Account, index: number) => {
        let value = this.parse_to_float((operation as FormGroup).controls['values'].value[index]);
        if (value && value !== 0) {
          op_values[account.key] = value;
        }
      });

      if (transaction.optional_accounts !== undefined) {
        transaction.optional_accounts.forEach((account: Account_def, index: number) => {
          let value = this.parse_to_float((operation as FormGroup).controls['optional_accounts'].value[index]);
          if (value && value !== 0) {
            op_values[account.key] = value;
          }
        });
      }


      return {
        label: (operation as FormGroup).controls['label']?.value,
        member: (operation as FormGroup).controls['member']?.value,
        values: op_values
      };
    });

    this.save_book_entry(amounts, operations);
  }

  negative_number_acceptable(bookEntry: BookEntry): boolean {
    // true if bank_transaction_id = vente_en_espèces || achat_adherent_en espece or all numbers are positive
    if (bookEntry.transaction_id === TRANSACTION_ID.vente_en_espèces) return true;
    if (bookEntry.transaction_id === TRANSACTION_ID.achat_adhérent_en_espèces) return true;
    if (this.transactionService.get_transaction(bookEntry.transaction_id).class === TRANSACTION_CLASS.REIMBURSEMENT) return true;
    let negative = false;
    Object.entries(bookEntry.amounts).forEach(([key, amount]: [string, number]) => {
      if (amount < 0) negative = true;
    }, 0);
    bookEntry.operations.forEach((operation) => {
      let values = operation.values;
      Object.entries(values).forEach(([key, amount]: [string, number]) => {
        if (amount < 0) negative = true;
      });
    });
    return !negative;
  }

  book_entry_balanced(bookEntry: BookEntry): boolean {
    let total_expense_or_revenue = 0;
    let total_financial = 0;
    let transaction = this.transactionService.get_transaction(bookEntry.transaction_id);

    Object.entries(bookEntry.amounts).forEach(([key, amount]: [string, number]) => {
      if (key.endsWith('_in')) total_financial += amount;
      if (key.endsWith('_out')) total_financial -= amount;
    }, 0);

    bookEntry.operations.forEach((operation) => {
      let values = operation.values;
      Object.entries(values).forEach(([key, amount]: [string, number]) => {
        if (key.endsWith('_in')) total_financial += amount;
        if (key.endsWith('_out')) total_financial -= amount;
        if (!key.endsWith('_in') && !key.endsWith('_out')) total_expense_or_revenue += amount;
      });
    }
    );

    if (!transaction.revenue_account_to_show) {
      total_expense_or_revenue = -total_expense_or_revenue;
    }

    return total_financial === total_expense_or_revenue;
  }


  // dynamoDB operations

  save_book_entry(amounts: { [key: string]: number }, operations: Operation[]) {

    let booking: BookEntry = {
      season: this.systemDataService.get_season(new Date(this.form.controls['date'].value)),
      date: this.form.controls['date'].value,
      id: this.form.controls['id'].value,
      transaction_id: this.form.controls['transaction_id'].value,
      cheque_ref: this.form.controls['bank_name'].value?.toString() + this.form.controls['cheque_number'].value?.toString(),
      deposit_ref: this.form.controls['deposit_ref'].value ?? undefined,
      invoice_ref: this.form.controls['invoice_ref'].value ?? undefined,
      tag: this.form.controls['tag'].value ?? undefined,
      amounts: amounts,
      operations: operations
    };

    if (!this.book_entry_balanced(booking)) {
      this.toastService.showWarning('erreur', 'total des dépenses différent du total financier');
      return;
    }
    if (!this.negative_number_acceptable(booking)) {
      this.toastService.showWarning('erreur', 'montant négatif non autorisé');
      return;
    }

    if (!booking.cheque_ref || booking.cheque_ref === 'undefined') delete booking.cheque_ref;

    if (this.creation) {
      this.bookService.create_book_entry(booking).then(() => {
        this.toastService.showSuccess('création', 'écriture enregistrée');
        this.reset_form();
      })
        .catch((error) => {
          this.toastService.showErrorToast('erreur', 'écriture non enregistrée');
        });
    } else {
      booking.id = this.book_entry_id;
      this.bookService.update_book_entry(booking).then(() => {
        // changement de toutes les références de dépôt associées au mouvement de chèque
        this.toastService.showSuccess('correction', 'écriture modifiée');

        if (booking.deposit_ref !== null
          && booking.deposit_ref !== this.selected_book_entry.deposit_ref
          && booking.transaction_id === TRANSACTION_ID.dépôt_caisse_chèques) {
          this.bookService.update_deposit_refs(this.selected_book_entry.deposit_ref!, booking.deposit_ref!);
        }

        this.location.back();
      });
    }
  }

  async delete_book_entry() {
    try {
      this.bookService.delete_book_entry(this.selected_book_entry);
      this.toastService.showSuccess('écriture BD', 'écriture supprimée');
      this.location.back();
    }
    catch (error) {
      this.toastService.showErrorToast('écriture BD', 'vous ne pouvez pas supprimer cette écriture');
    }
  }



  // events

  cancel() {
    this.location.back();
  }

  sum_amounts(amount: any) {
    let cntrl = amount as FormControl;
    cntrl.setValue(this.operations_grand_total());
  }

  private lastClickTime: number = 0;

  handleClick(amount: any) {
    const now = Date.now();
    if (now - this.lastClickTime < 400) {
      this.sum_amounts(amount);
    }
    this.lastClickTime = now;
  }

  // getters


  get transaction_id(): TRANSACTION_ID {
    return this.form.get('transaction_id')?.value;
  }

  get operations(): FormArray {
    return this.form.get('operations') as FormArray;
  }
  get amounts(): FormArray {
    return this.form.get('amounts') as FormArray;
  }

  get date(): string {
    const dateControl = this.form.get('date');
    if (dateControl) {
      console.log(dateControl.value);
    }
    else {
      console.log('date control is null');
    }
    return dateControl ? dateControl.value : '';
  }
  get dateErrors() {
    const control = this.form.get('date');
    return control ? control.errors : null;
  }

  // utilities

  dateSeasonValidator = (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (!value || !this.season) return null;
    return this.date_in_season(value) ? null : { notInSeason: true };
  };

  operations_grand_total(): number {
    let grand_total = 0;
    this.operations.controls.forEach((operation) => {
      grand_total += parseFloat((operation as FormGroup).controls['total'].value);
    });
    return grand_total < 0 ? -grand_total : grand_total;
  }

  expense_or_revenue_accounts(transaction: Transaction): Account[] {
    if (transaction === undefined) { throw new Error('transaction is undefined'); };
    if (transaction.pure_financial) return [];
    return transaction.revenue_account_to_show ? this.products_accounts : this.expenses_accounts;
  }

  transaction_label(transaction_id: TRANSACTION_ID): string {
    return this.transactionService.get_transaction(transaction_id).label;
  }

  transaction_tooltip(transaction_id: TRANSACTION_ID): string {
    return this.transactionService.get_transaction(transaction_id).tooltip;
  }

  transaction_with_cheque(transaction_id: TRANSACTION_ID): boolean {
    return this.transactionService.get_transaction(transaction_id).cheque !== 'none';
  }
  transaction_with_cheque_in(transaction_id: TRANSACTION_ID): boolean {
    return (this.transactionService.get_transaction(transaction_id).cheque === 'in');
  }
  transaction_with_cheque_out(transaction_id: TRANSACTION_ID): boolean {
    return (this.transactionService.get_transaction(transaction_id).cheque === 'out');
  }

  transaction_with_deposit(transaction_id: TRANSACTION_ID): boolean {
    return this.transactionService.get_transaction(transaction_id).require_deposit_ref;
  }

  transaction_with_invoice(transaction_id: TRANSACTION_ID): boolean {
    return this.transactionService.get_transaction(transaction_id).invoice_required;
  }

  parse_to_string(value: number): string {
    return value !== undefined ? value.toString() : '';
  }
  parse_to_float(value: string): number {
    return (!Number.isNaN(value) && value !== '') ? parseFloat(value) : 0;
  }

  atLeastOneFieldValidator(control: AbstractControl): ValidationErrors | null {
    const valid = control.value.some((value: string) => value !== '');
    return valid ? null : { atLeastOneFieldRequired: true };
  }

  date_in_season(date: string): boolean {
    return this.systemDataService.date_in_season(date, this.season);
  }

  add_invoice_ref() {
    const modalRef = this.modalService.open(InvoiceSelectComponent, { size: 'lg' });
    modalRef.componentInstance.directory = this.season;
    modalRef.componentInstance.invoiceSelected.subscribe(async (filename: string) => {
      try {
        modalRef.close();
        this.form.controls['invoice_ref'].setValue(filename);
        if (!this.creation && this.selected_book_entry) {
          this.selected_book_entry.invoice_ref = filename;
          await this.bookService.update_book_entry(this.selected_book_entry);
          this.toastService.showSuccess('Référence facture', 'la référence de la facture a été ajoutée à l\'écriture');
        } else {
          // En mode création, on ne fait rien de plus : la référence sera prise en compte à la création
          this.toastService.showSuccess('Référence facture', 'la référence de la facture a été ajoutée au formulaire. Elle sera enregistrée lors de la création.');
        }
      } catch (err) {
        console.error('Error updating book entry with invoice ref:', err);
        this.toastService.showErrorToast('Référence facture', 'Une erreur est survenue lors de l\'ajout de la référence de la facture à l\'écriture');
      }
    });
  }

  // Gestion du fichier orphelin en cas d'annulation ou suppression en mode création
  cleanup_orphan_invoice_file() {
    const invoice_ref = this.form.controls['invoice_ref'].value;
    if (invoice_ref) {
      this.invoiceService.delete_invoice(invoice_ref, this.season).then(() => {
        this.toastService.showSuccess('Suppression facture orpheline', invoice_ref + ' a été supprimé avec succès.');
        this.form.controls['invoice_ref'].setValue('');
      }).catch((err) => {
        console.error('Error deleting orphan invoice:', err);
        this.toastService.showErrorToast('Suppression facture orpheline', 'Une erreur est survenue lors de la suppression de la facture orpheline.');
      });
    }
  }

  clear_invoice_ref() {
    const invoice_ref = this.form.controls['invoice_ref'].value;
    this.selected_book_entry.invoice_ref = '';
    this.bookService.update_book_entry(this.selected_book_entry).then(() => {
      this.toastService.showSuccess('Suppression référence facture', 'la référence de la facture a été supprimée de l\'écriture');
    }).catch((err) => {
      console.error('Error updating book entry:', err);
      this.toastService.showErrorToast('Suppression référence facture', 'Une erreur est survenue lors de la suppression de la référence de la facture de l\'écriture');
    });
    this.invoiceService.delete_invoice(invoice_ref, this.season).then(() => {
      this.toastService.showSuccess('Suppression facture', invoice_ref + ' a été supprimé avec succès.');
    }).catch((err) => {
      console.error('Error deleting invoice:', err);
      this.toastService.showErrorToast('Suppression facture', 'Une erreur est survenue lors de la suppression de la facture.');
    });
    this.form.controls['invoice_ref'].setValue('');
  }

  onBack() {
    // Si en mode création et une facture a été sélectionnée, supprimer le fichier orphelin
    if (this.creation && this.form.controls['invoice_ref'].value) {
      this.cleanup_orphan_invoice_file();
    }
    this.location.back();
  }


}
