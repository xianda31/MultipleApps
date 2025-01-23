import { CommonModule, formatDate } from '@angular/common';
import { Component, Input, SimpleChanges } from '@angular/core';
import { Location } from '@angular/common';
import { AbstractControl, FormArray, FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { BookService } from '../../book.service';
import { bank_values, Bookentry, operation_values, RECORD_CLASS, season, BANK_OPERATION_TYPE, Operation } from '../../../../../common/accounting.interface';
import { Bank } from '../../../../../common/system-conf.interface';
import { SystemDataService } from '../../../../../common/services/system-data.service';
import { ToastService } from '../../../../../common/toaster/toast.service';
import { Transaction, get_transaction, bank_op_types_for_class } from '../../../../../common/transaction.definition';
import { MembersService } from '../../../../../admin-dashboard/src/app/members/service/members.service';
import { Member } from '../../../../../common/member.interface';
import { ActivatedRoute, Router } from '@angular/router';

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

  BANK_OPERATION_TYPES = BANK_OPERATION_TYPE;
  op_types !: BANK_OPERATION_TYPE[];
  RECORD_CLASSES = RECORD_CLASS;
  op_classes = Object.values(RECORD_CLASS); //.filter((value) => value !== RECORD_CLASS.REVENUE_FROM_MEMBER);
  form!: FormGroup;
  form_ready = false;

  creation = false;
  selected_book_entry!: Bookentry;
  accounting_operation?: Transaction;

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
          this.bookService.read_book_entry(this.book_entry_id)
            .then((book_entry) => {
              this.init_form();
              this.set_form(book_entry);
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
    this.accounting_operation = undefined!;
    this.form = this.fb.group({
      'id': [''],
      'date': [today, Validators.required],
      'op_class': ['', Validators.required],
      'op_type': ['', Validators.required],
      'total': new FormControl<number>({ value: 0, disabled: true }),
      'bank_name': [''],
      'cheque_number': [''],
      'deposit_ref': [''],
      'operations': new FormArray([]),
    });

  }

  valueChanges_subscribe() {
    // form.op_class
    this.form.controls['op_class'].valueChanges.subscribe((op_class) => {
      this.accounting_operation = undefined!;
      this.op_types = bank_op_types_for_class(op_class);

      this.operations.clear();
      this.form.controls['op_type'].setValue('', { emitEvent: false });

      switch (this.op_class) {
        case RECORD_CLASS.EXPENSE:
          this.add_operation(this.expenses_accounts, op_class);
          console.log('operation n° %s added', this.operations.length);
          break;
        case RECORD_CLASS.REVENUE_FROM_MEMBER:
        case RECORD_CLASS.OTHER_REVENUE:
          this.add_operation(this.revenues_accounts, op_class);
          console.log('operation n° %s added', this.operations.length);
          break;
        case RECORD_CLASS.MOVEMENT:
          this.form.controls['total'].enable();
          console.log('total enabled');
          break;
      }
    });


    // form.op_type

    this.form.controls['op_type'].valueChanges.subscribe((op_type) => {
      this.accounting_operation = get_transaction(this.op_class, op_type);
      // gestion des validators pour les champs bank_name et cheque_ref
      switch (op_type) {
        case BANK_OPERATION_TYPE.cheque_deposit:
          this.form.controls['bank_name'].setValidators([Validators.required]);
          this.form.controls['cheque_number'].setValidators([Validators.required]);
          break;
        case BANK_OPERATION_TYPE.cheque_emit:
          this.form.controls['bank_name'].setValidators([Validators.required]);
          this.form.controls['cheque_number'].setValidators([Validators.required]);
          this.form.controls['bank_name'].patchValue(this.club_bank.key);
          this.form.controls['bank_name'].disable();
          break;
        default:
          this.form.controls['bank_name'].clearValidators();
          this.form.controls['cheque_number'].clearValidators();
          console.log('bank_name and cheque_number validators cleared');
          break;
      }
    });


  }

  add_operation(accounts: string[], label: string, values?: { [key: string]: number }, member?: string) {
    let operationForm = this.fb.group({
      'member': [member ?? '', member ? { validators: Validators.required } : {}],
      'label': [label],
      'values': this.fb.array(
        (accounts.map(field => new FormControl<string>((values?.[field]?.toString() ?? ''), [Validators.pattern(/^\d+(\.\d+)?$/)]))),
        { validators: [this.atLeastOneFieldValidator] }),
    });
    this.operations.push(operationForm);
    this.set_operationForm_change_detection(operationForm);
  }

  set_operationForm_change_detection(operationForm: FormGroup) {
    operationForm.controls['values'].valueChanges.subscribe(() => {
      let total = 0;
      this.operations.controls.forEach((operation) => {
        total += (operation as FormGroup).controls['values'].value
          .map((val: string) => this.parse_to_float(val))
          .reduce((acc: number, val: number) => acc + val, 0);
      });
      this.form.controls['total'].setValue(total);
    });
  }

  set_form(book_entry: Bookentry) {

    console.log('book_entry to set', book_entry);
    this.selected_book_entry = book_entry;

    this.accounting_operation = get_transaction(book_entry.class, book_entry.bank_op_type);
    this.op_types = bank_op_types_for_class(book_entry.class);
    // console.log('op types changed', this.op_types);
    let total = 0;
    switch (book_entry.class) {
      case RECORD_CLASS.EXPENSE:
        total = book_entry.amounts[this.accounting_operation.account_to_credit!] || 0;
        this.form.controls['total'].disable();
        break;
      case RECORD_CLASS.REVENUE_FROM_MEMBER:
        total = book_entry.amounts[this.accounting_operation.account_to_debit!] || 0;
        this.form.controls['total'].disable();
        break;
      case RECORD_CLASS.OTHER_REVENUE:
        total = book_entry.amounts[this.accounting_operation.account_to_debit!] || 0;
        this.form.controls['total'].disable();
        break;
      case RECORD_CLASS.MOVEMENT:
        total = book_entry.amounts[this.accounting_operation.account_to_debit!] || 0;
        this.form.controls['total'].enable();
        break;
    }

    this.form.patchValue({
      id: book_entry.id,
      date: book_entry.date,
      op_class: book_entry.class,
      op_type: book_entry.bank_op_type,
      total: total,
      bank_name: book_entry.cheque_ref?.slice(0, 3),
      cheque_number: book_entry.cheque_ref?.slice(3),
      deposit_ref: book_entry.deposit_ref,
    });

    this.operations.clear();
    book_entry.operations.forEach((operation) => {
      if (book_entry.class === RECORD_CLASS.EXPENSE) {
        this.add_operation(this.expenses_accounts, operation.label!, operation.values, operation.member);
      } else {
        this.add_operation(this.revenues_accounts, operation.label!, operation.values, operation.member);
      }
    });

  };



  onSubmit() {
    console.log('submitted form', this.form.value);
    let operations: Operation[] = [];
    let amounts: bank_values = {};
    let total = 0;
    let TRANSACTIONS = get_transaction(this.op_class, this.form.controls['op_type'].value);


    if ((TRANSACTIONS.class === RECORD_CLASS.OTHER_REVENUE) || (TRANSACTIONS.class === RECORD_CLASS.REVENUE_FROM_MEMBER)) {
      operations = this.operations.controls.map((operation) => {
        let op_values: operation_values = {};
        this.revenues_accounts.forEach((account: string, index: number) => {
          let value = this.parse_to_float((operation as FormGroup).controls['values'].value[index]);
          if (value !== 0) {
            op_values[account] = value;
            total += value;
          }
        });
        return {
          label: (operation as FormGroup).controls['label'].value,
          member: (operation as FormGroup).controls['member'].value,
          values: op_values
        };
      });
    }
    if (TRANSACTIONS.class === RECORD_CLASS.EXPENSE) {
      operations = this.operations.controls.map((operation) => {
        let op_values: operation_values = {};
        this.expenses_accounts.forEach((account: string, index: number) => {
          let value = this.parse_to_float((operation as FormGroup).controls['values'].value[index]);
          if (value !== 0) {
            op_values[account] = value;
            total += value;
          }
        });
        return {
          label: (operation as FormGroup).controls['label'].value,
          member: (operation as FormGroup).controls['member'].value,
          values: op_values
        };
      });
    }
    if (TRANSACTIONS.class === RECORD_CLASS.MOVEMENT) {
      total = this.parse_to_float(this.form.controls['total'].value);
    }
    if (TRANSACTIONS.account_to_debit) amounts[TRANSACTIONS.account_to_debit] = total;
    if (TRANSACTIONS.account_to_credit) amounts[TRANSACTIONS.account_to_credit] = total;


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
    // if (booking.operations[0].member === '') delete booking.operations[0].member;


    console.log('book_entry to save', booking);
    if (this.creation) {
      this.bookService.create_book_entry(booking).then(() =>
        this.toastService.showSuccessToast('création', 'écriture enregistrée'));
      this.init_form();
    } else {
      booking.id = this.book_entry_id;
      this.bookService.update_book_entry(booking).then(() =>
        this.toastService.showSuccessToast('correction', 'écriture modifiée'));
      this.location.back();
    }
  }

  delete() {
    this.bookService.delete_book_entry(this.book_entry_id).then(() =>
      this.toastService.showSuccessToast('suppression', 'écriture supprimée'));
    this.location.back();
  }

  cancel() {
    this.location.back();
  }


  // getters


  get op_type(): BANK_OPERATION_TYPE {
    return this.form.get('op_type')?.value;
  }
  get op_class(): RECORD_CLASS {
    return this.form.get('op_class')?.value;
  }
  get operations(): FormArray {
    return this.form.get('operations') as FormArray;
  }

  // utilities

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


