import { CommonModule, formatDate } from '@angular/common';
import { Component } from '@angular/core';
import { Location } from '@angular/common';
import { AbstractControl, FormArray, FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { BookService } from '../../book.service';
import { BookEntry, operation_values, BOOK_ENTRY_CLASS, season, Operation, FINANCIAL_ACCOUNT, ENTRY_TYPE } from '../../../../../common/accounting.interface';
import { Bank } from '../../../../../common/system-conf.interface';
import { SystemDataService } from '../../../../../common/services/system-data.service';
import { ToastService } from '../../../../../common/toaster/toast.service';
import { Transaction, get_transaction, class_types, Account_def } from '../../../../../common/transaction.definition';
import { MembersService } from '../../../../../admin-dashboard/src/app/members/service/members.service';
import { Member } from '../../../../../common/member.interface';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';

interface Operation_initial_values {
  customer_accounts?: string[];
  label?: string;
  member?: string;
  values?: { [key: string]: number };
}
@Component({
  selector: 'app-booking',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './books-editor.component.html',
  styleUrl: './books-editor.component.scss'
})
export class BooksEditorComponent {
  book_entry_id!: string;
  banks !: Bank[];
  club_bank!: Bank;
  members!: Member[];
  expenses_accounts !: string[];
  products_accounts !: string[];
  financial_accounts !: Account_def[];
  customer_accounts !: Account_def[];
  profit_and_loss_accounts !: string[];

  op_types !: ENTRY_TYPE[];

  transaction_classes = Object(BOOK_ENTRY_CLASS);

  form!: FormGroup;

  form_ready = false;
  creation = false;
  financial_accounts_locked = true;

  deposit_ref_changed = false;
  selected_book_entry!: BookEntry;

  transaction?: Transaction;

  operations_valueChanges_subscription!: Subscription;

  constructor(
    private fb: FormBuilder,
    private bookService: BookService,
    private systemDataService: SystemDataService,
    private membersService: MembersService,
    private toastService: ToastService,
    private route: ActivatedRoute,
    private location: Location

  ) { }

  ngOnInit() {


    this.membersService.listMembers().subscribe((members) => {
      this.members = members;
    });

    this.systemDataService.configuration$.subscribe((conf) => {
      this.banks = conf.banks;
      this.club_bank = this.banks.find(bank => bank.key === 'AGR')!;
      this.expenses_accounts = conf.charge_accounts.map((account) => account.key);
      this.products_accounts = conf.product_accounts.map((account) => account.key);
    });

    this.init_form();

    this.route.params.subscribe(params => {
      this.book_entry_id = params['id']; // Access the 'id' parameter from the URL
      this.creation = (this.book_entry_id === undefined);
      if (!this.creation) {
        this.bookService.read_book_entry(this.book_entry_id)
          .then((book_entry) => {
            this.selected_book_entry = book_entry;
            console.log('editing book_entry', book_entry);
            this.set_form(book_entry);
            this.valueChanges_subscribe();
          })
          .catch((error) => { throw new Error('error reading book_entry', error) });

      } else {
        this.valueChanges_subscribe();
      }

      this.form_ready = true;

    });

  }

  operations_valueChanges_subscribe() {

    // operation change handler pour le calcul du total

    console.log('operations_valueChanges_subscribd');


    this.operations_valueChanges_subscription = this.operations.valueChanges.subscribe((op_values) => {
      console.log('operations_valueChanges : ', op_values);

      op_values.forEach((values: Operation_initial_values, index: number) => {
        let total: number = this.sum_operation_values(this.transaction!, values);
        (this.operations.at(index) as FormGroup).controls['total'].setValue(total, { emitEvent: false });
      });
    });
  }



  init_form() {
    const today = formatDate(new Date(), 'yyyy-MM-dd', 'en');
    this.transaction = undefined!;
    this.op_types = [];

    this.form = this.fb.group({
      'id': [''],
      'date': [today, Validators.required],
      'op_class': ['', Validators.required],
      'op_type': ['', Validators.required],
      'amounts': new FormArray([]),
      'bank_name': [''],
      'cheque_number': [''],
      'deposit_ref': [''],
      'operations': new FormArray([]),
    });
  }


  set_form(book_entry: BookEntry) {

    this.transaction = get_transaction(book_entry.bank_op_type);
    this.op_types = class_types(book_entry.class);

    this.financial_accounts = this.transaction.financial_accounts;

    this.form.patchValue({
      id: book_entry.id,
      date: book_entry.date,
      op_class: book_entry.class,
      op_type: book_entry.bank_op_type,
      bank_name: book_entry.cheque_ref?.slice(0, 3),
      cheque_number: book_entry.cheque_ref?.slice(3),
      deposit_ref: book_entry.deposit_ref,
    });

    this.form.get('op_class')?.disable();   // bloque le changment de la classe d'opération

    // création des champs amounts
    this.init_financial_accounts(this.transaction);

    this.financial_accounts.forEach((account) => {
      let value = book_entry.amounts[account.key as FINANCIAL_ACCOUNT] ?? '';
      (this.form.controls['amounts'] as FormArray).controls[this.financial_accounts.indexOf(account)].setValue(value);
    });

    // création des champs operations
    this.operations.clear();
    this.profit_and_loss_accounts = this.which_profit_and_loss_accounts(this.transaction);

    book_entry.operations.forEach((operation) => {
      this.add_operation(this.transaction!, operation);
    });
    this.operations_valueChanges_subscribe();


    if (this.transaction.cheque === 'out') {
      this.form.controls['bank_name'].disable();
    }

  };



  reset_form() {
    const today = formatDate(new Date(), 'yyyy-MM-dd', 'en');
    this.transaction = undefined!;
    this.op_types = [];
    this.form.controls['date'].setValue(formatDate(new Date(), 'yyyy-MM-dd', 'en'));
    this.financial_accounts_locked = true;
    this.operations.clear();
    this.amounts.clear();
    this.operations_valueChanges_subscription.unsubscribe();
  }

  valueChanges_subscribe() {
    // form.op_class change handler
    this.form.controls['op_class'].valueChanges.subscribe((op_class) => {
      this.transaction = undefined!;
      this.op_types = class_types(op_class);
      this.financial_accounts_locked = true;
    });

    // form.op_type change handler
    this.form.controls['op_type'].valueChanges.subscribe((op_type) => {
      this.transaction = get_transaction(op_type);

      // initialisation form operations si en mode création

      if (this.creation) {
        this.operations.clear();
        this.profit_and_loss_accounts = this.which_profit_and_loss_accounts(this.transaction);
        this.add_operation(this.transaction);
        // this.init_operation(this.transaction);
      }

      // operations valueChanges subscription
      this.operations_valueChanges_subscribe();

      // gestion des validators pour les champs bank_name et cheque_ref

      this.handle_cheque_info_validators(this.transaction);
      this.handled_deposit_ref_validators(this.transaction);

      // création des champs amounts
      if (this.creation) {
        this.amounts.clear();
        this.init_financial_accounts(this.transaction);
      }
      // this.handle_financial_accounts_enabling(this.transaction);
    });

    // form.deposit_ref change handler
    this.form.controls['deposit_ref'].valueChanges.subscribe((deposit_ref) => {
      if (!this.creation) {
        if (this.form.controls['op_type'].value === ENTRY_TYPE.cheque_deposit) {
          this.deposit_ref_changed = true;
        }
      };
    });

  }

  sum_operation_values(transaction: Transaction, values: Operation_initial_values): number {
    let total: number = 0;
    let profit_and_loss_accounts = this.which_profit_and_loss_accounts(transaction);
    profit_and_loss_accounts.forEach((account, index) => {
      let value = this.parse_to_float(values.values?.[index]?.toString() ?? '');
      total += value;
    });
    let customer_accounts = transaction.customer_accounts;
    if (customer_accounts !== undefined) {
      customer_accounts.forEach((account, index) => {
        let value = this.parse_to_float(values.customer_accounts?.[index]?.toString() ?? '');
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

  handled_deposit_ref_validators(transaction: Transaction) {
    if (transaction.require_deposit_ref) {
      this.form.controls['deposit_ref'].setValidators([Validators.required]);
    } else {
      this.form.controls['deposit_ref'].clearValidators();
    }
    this.form.controls['deposit_ref'].updateValueAndValidity();
  }

  add_operation(transaction: Transaction, operation_initial?: Operation) {

    let profit_and_loss_accounts = this.which_profit_and_loss_accounts(transaction);
    let label = transaction.label;

    let operationForm: FormGroup = this.fb.group({
      'label': [label.toLocaleLowerCase()],
      'values': this.fb.array(
        (profit_and_loss_accounts.map(field => new FormControl<string>((operation_initial?.values?.[field]?.toString() ?? ''), [Validators.pattern(/^\d+(\.\d+)?$/)])) as unknown[]),
        { validators: [this.atLeastOneFieldValidator] }),
    });
    if (transaction.nominative) {
      operationForm.addControl('member', new FormControl(operation_initial?.member ?? '', Validators.required));
    }


    let total = '';
    if (operation_initial) {
      total = this.sum_operation_values(transaction, operationForm.value).toString();
    }
    operationForm.addControl('total', new FormControl({ value: total, disabled: true }));

    if (transaction.customer_accounts !== undefined) {
      this.customer_accounts = transaction.customer_accounts;
      operationForm.addControl('customer_accounts', this.fb.array(
        this.customer_accounts.map((account_def) => new FormControl<string>((operation_initial?.values?.[account_def.key]?.toString() ?? ''), [Validators.pattern(/^\d+(\.\d+)?$/)]))
      ));
    }

    this.operations.push(operationForm);


  }

  init_financial_accounts(transaction: Transaction) {
    this.financial_accounts = transaction.financial_accounts;
    this.financial_accounts.forEach((account) => {
      if (transaction.financial_accounts_to_charge.includes(account.key)) {
        this.amounts.push(new FormControl('', [Validators.required, Validators.pattern(/^\d+(\.\d+)?$/)]));
      }
      else {
        this.amounts.push(new FormControl({ value: '', disabled: true }, [Validators.pattern(/^\d+(\.\d+)?$/)]));
      }
    });
  }

  handle_financial_accounts_enabling(transaction: Transaction) {
    this.financial_accounts.forEach((account, index) => {
      if (transaction.financial_accounts_to_charge.includes(account.key)) {
        this.amounts.controls[index].setValidators([Validators.required, Validators.pattern(/^\d+(\.\d+)?$/)]);
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
      this.handle_financial_accounts_enabling(this.transaction!);
    }
  }

  onSubmit() {
    let operations: Operation[] = [];
    let amounts: { [key: string]: number } = {};
    let transaction = get_transaction(this.op_type);

    // constructions des montants

    this.financial_accounts.forEach((account: Account_def, index: number) => {
      let value = this.parse_to_float((this.form.controls['amounts'] as FormArray).controls[index].value);
      if (value && value !== 0) {
        amounts[account.key] = value;
      }
    });

    // construction des opérations

    operations = this.operations.controls.map((operation) => {
      let op_values: operation_values = {};

      this.profit_and_loss_accounts.forEach((account: string, index: number) => {
        let value = this.parse_to_float((operation as FormGroup).controls['values'].value[index]);
        if (value && value !== 0) {
          op_values[account] = value;
        }
      });

      if (transaction.customer_accounts !== undefined) {
        transaction.customer_accounts.forEach((account: Account_def, index: number) => {
          let value = this.parse_to_float((operation as FormGroup).controls['customer_accounts'].value[index]);
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

  book_entry_balanced(bookEntry: BookEntry): boolean {
    let total_profit_and_loss = 0;
    let total_financial = 0;
    let transaction = get_transaction(bookEntry.bank_op_type);

    Object.entries(bookEntry.amounts).forEach(([key, amount]: [string, number]) => {
      if (key.endsWith('_in')) total_financial += amount;
      if (key.endsWith('_out')) total_financial -= amount;
    }, 0);

    bookEntry.operations.forEach((operation) => {
      let values = operation.values;
      Object.entries(values).forEach(([key, amount]: [string, number]) => {
        if (key.endsWith('_in')) total_financial += amount;
        if (key.endsWith('_out')) total_financial -= amount;
        if (!key.endsWith('_in') && !key.endsWith('_out')) total_profit_and_loss += amount;
      });
    }
    );

    if (!transaction.is_of_profit_type) {
      total_profit_and_loss = -total_profit_and_loss;
    }

    return total_financial === total_profit_and_loss;
  }


  // dynamoDB operations

  save_book_entry(amounts: { [key: string]: number }, operations: Operation[]) {

    let booking: BookEntry = {
      season: season(new Date(this.form.controls['date'].value)),
      date: this.form.controls['date'].value,
      id: this.form.controls['id'].value,
      bank_op_type: this.form.controls['op_type'].value,
      cheque_ref: this.form.controls['bank_name'].value?.toString() + this.form.controls['cheque_number'].value?.toString(),
      deposit_ref: this.form.controls['deposit_ref'].value ?? null,
      amounts: amounts,
      class: this.form.controls['op_class'].value,
      operations: operations
    };

    if (!this.book_entry_balanced(booking)) {
      this.toastService.showWarningToast('erreur', 'total des dépenses différent du total financier');
      return;
    }



    if (booking.cheque_ref === '') delete booking.cheque_ref;

    if (this.creation) {
      this.bookService.create_book_entry(booking).then(() =>
        this.toastService.showSuccessToast('création', 'écriture enregistrée'));
      console.log('book_entry created', booking);
      this.reset_form();
    } else {
      booking.id = this.book_entry_id;
      this.bookService.update_book_entry(booking).then(() => {
        // changement de toutes les références de dépôt associées au mouvement de chèque
        this.toastService.showSuccessToast('correction', 'écriture modifiée');

        if (booking.deposit_ref !== null
          && booking.deposit_ref !== this.selected_book_entry.deposit_ref
          && booking.bank_op_type === ENTRY_TYPE.cheque_deposit) {
          this.bookService.update_deposit_refs(this.selected_book_entry.deposit_ref!, booking.deposit_ref!);
        }

        this.location.back();
      });
    }
  }

  delete_book_entry() {
    this.bookService.delete_book_entry(this.book_entry_id).then(() =>
      this.toastService.showSuccessToast('suppression', 'écriture supprimée'));
    this.location.back();
  }



  // events

  cancel() {
    this.location.back();
  }

  double_click(amount: any) {
    let cntrl = amount as FormControl;
    cntrl.setValue(this.operations_grand_total());
  }

  // getters


  get op_type(): ENTRY_TYPE {
    return this.form.get('op_type')?.value;
  }
  get op_class(): BOOK_ENTRY_CLASS {
    return this.form.get('op_class')?.value;
  }
  get operations(): FormArray {
    return this.form.get('operations') as FormArray;
  }
  get amounts(): FormArray {
    return this.form.get('amounts') as FormArray;
  }


  // utilities

  operations_grand_total(): number {
    let grand_total = 0;
    this.operations.controls.forEach((operation) => {
      grand_total += parseFloat((operation as FormGroup).controls['total'].value);
    });
    return grand_total;
  }
  which_profit_and_loss_accounts(transaction: Transaction): string[] {
    if (transaction.is_of_profit_type === undefined) return [];
    return transaction.is_of_profit_type ? this.products_accounts : this.expenses_accounts;
  }

  transaction_label(op_type: ENTRY_TYPE): string {
    return get_transaction(op_type).label;
  }
  transaction_with_cheque(op_type: ENTRY_TYPE): boolean {
    return get_transaction(op_type).cheque !== 'none';
  }
  transaction_with_cheque_in(op_type: ENTRY_TYPE): boolean {
    return (get_transaction(op_type).cheque === 'in');
  }
  transaction_with_cheque_out(op_type: ENTRY_TYPE): boolean {
    return (get_transaction(op_type).cheque === 'out');
  }

  transaction_with_deposit(op_type: ENTRY_TYPE): boolean {
    return get_transaction(op_type).require_deposit_ref;
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
}


