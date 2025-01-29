import { CommonModule, formatDate } from '@angular/common';
import { Component } from '@angular/core';
import { Location } from '@angular/common';
import { AbstractControl, FormArray, FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { BookService } from '../../book.service';
import { Bookentry, operation_values, BOOK_ENTRY_CLASS, season, Operation, FINANCIAL_ACCOUNT, ENTRY_TYPE } from '../../../../../common/accounting.interface';
import { Bank } from '../../../../../common/system-conf.interface';
import { SystemDataService } from '../../../../../common/services/system-data.service';
import { ToastService } from '../../../../../common/toaster/toast.service';
import { Transaction, get_transaction, class_types } from '../../../../../common/transaction.definition';
import { MembersService } from '../../../../../admin-dashboard/src/app/members/service/members.service';
import { Member } from '../../../../../common/member.interface';
import { ActivatedRoute } from '@angular/router';

interface AddOperationOptions {
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
  expenses_accounts !: string[]; //= Object.values(EXPENSES_ACCOUNTS);
  revenues_accounts !: string[]; //= Object.values(PRODUCTS_ACCOUNTS);
  financial_accounts = Object.values(FINANCIAL_ACCOUNT);

  op_types !: ENTRY_TYPE[];

  transaction_classes = Object(BOOK_ENTRY_CLASS);
  transaction_class_values = Object.values(BOOK_ENTRY_CLASS);

  form!: FormGroup;

  form_ready = false;
  creation = false;
  financial_accounts_locked = true;

  deposit_ref_changed = false;

  selected_book_entry!: Bookentry;
  transaction?: Transaction;

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
      this.revenues_accounts = conf.product_accounts.map((account) => account.key);

      this.route.params.subscribe(params => {
        this.book_entry_id = params['id']; // Access the 'id' parameter from the URL
        if (this.book_entry_id !== undefined) {
          // component in edition mode
          this.bookService.read_book_entry(this.book_entry_id)
            .then((book_entry) => {
              this.init_form();
              this.set_form(book_entry);
              this.form.get('op_class')!.disable();
              this.valueChanges_subscribe();
              this.creation = false;
              this.form_ready = true;
            })
            .catch((error) => { throw new Error('error reading book_entry', error) });
        } else {
          // component in creation mode
          this.init_form();
          this.valueChanges_subscribe();
          this.creation = true;
          this.form_ready = true;
        }
      });

      this.route.parent?.params.subscribe(params => {
        console.log('parent params', params);
      });
    });
  }

  init_form() {
    const today = formatDate(new Date(), 'yyyy-MM-dd', 'en');
    this.transaction = undefined!;
    this.form = this.fb.group({
      'id': [''],
      'date': [today, Validators.required],
      'op_class': ['', Validators.required],
      'op_type': ['', Validators.required],
      'amounts': new FormArray(
        (this.financial_accounts.map(field => new FormControl<string>(({ value: '', disabled: false }), [Validators.pattern(/^\d+(\.\d+)?$/)]))),
        { validators: [this.atLeastOneFieldValidator] }),
      'bank_name': [''],
      'cheque_number': [''],
      'deposit_ref': [''],
      'operations': new FormArray([]),
    });

  }

  init_operation(transaction: Transaction) {


    let option = transaction.nominative ? { member: '' } : {};
    switch (transaction.class) {
      case BOOK_ENTRY_CLASS.EXPENSE:
        this.add_operation(this.expenses_accounts, transaction.label, option);
        break;
      case BOOK_ENTRY_CLASS.REVENUE_FROM_MEMBER:
      case BOOK_ENTRY_CLASS.OTHER_REVENUE:
        this.add_operation(this.revenues_accounts, transaction.label, option);
        break;
      case BOOK_ENTRY_CLASS.MOVEMENT:
        console.log('total enabled');
        break;
    }
  }

  valueChanges_subscribe() {
    // form.op_class
    this.form.controls['op_class'].valueChanges.subscribe((op_class) => {
      this.transaction = undefined!;
      this.op_types = class_types(op_class);
      this.form.controls['op_type'].setValue('', { emitEvent: false });
      this.financial_accounts_locked = true;
    });


    // form.op_type

    this.form.controls['op_type'].valueChanges.subscribe((op_type) => {

      this.transaction = get_transaction(op_type);



      // initialisation form operations si en mode création

      if (this.creation) this.init_operation(this.transaction);

      // gestion des validators pour les champs bank_name et cheque_ref

      switch (this.transaction.cheque) {
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


      // gestion des disablings pour les champs amounts

      if (this.creation) this.amounts.controls.forEach((control) => { control.reset(); });
      this.handle_financial_accounts_enabling(this.transaction);

    });

    // form.deposit_ref

    this.form.controls['deposit_ref'].valueChanges.subscribe((deposit_ref) => {
      if (!this.creation) {
        if (this.form.controls['op_type'].value === ENTRY_TYPE.cheque_deposit) {
          this.deposit_ref_changed = true;
        }
      };
    });

  }


  add_operation(accounts: string[], label: string, options: Partial<AddOperationOptions> = {}) {
    let operationForm: FormGroup = this.fb.group({
      'label': [label],
      'values': this.fb.array(
        (accounts.map(field => new FormControl<string>((options.values?.[field]?.toString() ?? ''), [Validators.pattern(/^\d+(\.\d+)?$/)]))),
        { validators: [this.atLeastOneFieldValidator] }),
    });
    if (options.member !== undefined) {
      operationForm.addControl('member', new FormControl(options.member, Validators.required));
    }

    this.operations.push(operationForm);
    // this.set_operationForm_change_detection(operationForm);
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

  handle_financial_accounts_enabling(transaction: Transaction) {

    this.amounts.controls.forEach((control) => {
      control.disable();
    });
    let account = transaction.financial_account_to_debit;
    if (account) {
      this.amounts.controls[this.financial_accounts.indexOf(account)].enable();
    }

    account = transaction.financial_account_to_credit
    if (account) {
      this.amounts.controls[this.financial_accounts.indexOf(account)].enable();
    }

  }


  set_form(book_entry: Bookentry) {

    this.selected_book_entry = book_entry;

    this.transaction = get_transaction(book_entry.bank_op_type);
    this.op_types = class_types(book_entry.class);


    this.form.patchValue({
      id: book_entry.id,
      date: book_entry.date,
      op_class: book_entry.class,
      op_type: book_entry.bank_op_type,
      // total: total,
      // amounts: book_entry.amounts,   => calculé par les lignes suivantes
      bank_name: book_entry.cheque_ref?.slice(0, 3),
      cheque_number: book_entry.cheque_ref?.slice(3),
      deposit_ref: book_entry.deposit_ref,
    });

    this.financial_accounts.forEach((account) => {
      let value = book_entry.amounts[account] ?? '';
      (this.form.controls['amounts'] as FormArray).controls[this.financial_accounts.indexOf(account)].setValue(value);
    });
    this.handle_financial_accounts_enabling(this.transaction);

    this.operations.clear();
    book_entry.operations.forEach((operation) => {
      if (book_entry.class === BOOK_ENTRY_CLASS.EXPENSE) {
        this.add_operation(this.expenses_accounts, operation.label!, { values: operation.values, member: operation.member });
      }
      if (book_entry.class === BOOK_ENTRY_CLASS.REVENUE_FROM_MEMBER || book_entry.class === BOOK_ENTRY_CLASS.OTHER_REVENUE) {
        this.add_operation(this.revenues_accounts, operation.label!, { values: operation.values, member: operation.member });
      }
    });

    if (this.transaction.cheque === 'out') {
      this.form.controls['bank_name'].disable();
    }
  };



  onSubmit() {
    let operations: Operation[] = [];
    let amounts: { [key: string]: number } = {};
    let total_revenue = 0;
    let total_expense = 0;
    let total_financial = 0;

    let TRANSACTIONS = get_transaction(this.form.controls['op_type'].value);

    // constructions des montants

    this.financial_accounts.forEach((account: string, index: number) => {
      let value = this.parse_to_float((this.form.controls['amounts'] as FormArray).controls[index].value);
      if (value && value !== 0) {
        amounts[account] = value;
        if (account.endsWith('_in')) total_financial += value;
        if (account.endsWith('_out')) total_financial -= value;
      }
    });

    // construction des opérations

    switch (TRANSACTIONS.class) {



      case BOOK_ENTRY_CLASS.REVENUE_FROM_MEMBER:
      case BOOK_ENTRY_CLASS.OTHER_REVENUE:

        operations = this.operations.controls.map((operation) => {
          let op_values: operation_values = {};
          this.revenues_accounts.forEach((account: string, index: number) => {
            let value = this.parse_to_float((operation as FormGroup).controls['values'].value[index]);
            if (value && value !== 0) {
              op_values[account] = value;
              total_revenue += value;
            }
          });
          return {
            label: (operation as FormGroup).controls['label'].value,
            member: (operation as FormGroup).controls['member'].value,
            values: op_values
          };
        });

        if (total_revenue !== total_financial) {
          this.toastService.showWarningToast('erreur', 'total des recettes différent du total financier');
          return;
        } else {
          this.create_book_entry(amounts, operations);
        }
        break;

      case BOOK_ENTRY_CLASS.EXPENSE:

        operations = this.operations.controls.map((operation) => {
          let op_values: operation_values = {};
          this.expenses_accounts.forEach((account: string, index: number) => {
            let value = this.parse_to_float((operation as FormGroup).controls['values'].value[index]);
            if (value && value !== 0) {
              op_values[account] = value;
              total_expense += value;
            }
          });
          return {
            label: (operation as FormGroup).controls['label'].value,
            member: (operation as FormGroup).controls['member']?.value,
            values: op_values
          };
        });

        if (total_expense !== -total_financial) {
          this.toastService.showWarningToast('erreur', 'total des dépenses différent du total financier');
          console.log('erreur', this.form);
          console.log('revenue : %s expenses: %s , financial %s', total_revenue, total_expense, total_financial);

          return;
        } else { this.create_book_entry(amounts, operations); }

        break;

      case BOOK_ENTRY_CLASS.MOVEMENT:
        this.create_book_entry(amounts, operations);
        break;
    }

  }

  create_book_entry(amounts: { [key: string]: number }, operations: Operation[]) {

    let booking: Bookentry = {
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

    if (booking.cheque_ref === '') delete booking.cheque_ref;

    if (this.creation) {
      this.bookService.create_book_entry(booking).then(() =>
        this.toastService.showSuccessToast('création', 'écriture enregistrée'));
      this.init_form();
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

  cancel() {
    this.location.back();
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
    return get_transaction(op_type).deposit;
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


